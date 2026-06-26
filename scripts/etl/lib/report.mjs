/**
 * Reconciliation report builder — Phase 02, Plan 04, Task 1.
 *
 * Pure, DB-free. Consumes the in-memory stats/summaries produced by a single
 * ETL run (merge stats, validate summary, fitment summary, category stats, load
 * stats) and emits the make-or-break reconciliation report the user reviews at
 * the manual acceptance gate (CONTEXT). NO `src/` imports, no database access.
 *
 * `buildReport(data)` -> { markdown, csv, summaryLine }   (in-memory render)
 * `writeReport(report, dir)` -> { mdPath, csvPath }       (versioned files)
 *
 * Every CONTEXT-required section is present:
 *   - counts: total / matched / orphan vs the ~10,849 target; parents (vs 10,263);
 *     variants; published vs quarantined; quarantine-by-reason (price, shipping)
 *   - missing-by-field: size-null, OEM-null, image-0 (placeholder), prop65-null
 *   - fitment normalization: makes (list, ~10), models (~40), make-only (~13),
 *     ambiguous (~0), and the ~52 multi-make strings LISTED under a "Review
 *     fitment (cartesian over-attach)" heading with the Pitfall-2 caveat
 *   - category tree: distinct (L1,L2) pairs with the 147-vs-169 delta note
 *   - comparison vs the ~10,849 target (matched / orphan)
 *   - CSV: a flat metric,value file suitable for diffing across runs
 */
import { mkdirSync, writeFileSync } from "node:fs";

const TARGET_VARIANTS = 10849;
const TARGET_PARENTS = 10263;
const TARGET_L2_PAIRS_NOTE = 147; // the figure to compare the observed pairs against

/** Format a number with thousands separators (US), or "-" for null/undefined. */
function n(v) {
  if (v == null || Number.isNaN(v)) return "-";
  return Number(v).toLocaleString("en-US");
}

/** Coerce a Set/array/number to a sorted array of strings. */
function toList(v) {
  if (v == null) return [];
  if (v instanceof Set) return [...v];
  if (Array.isArray(v)) return [...v];
  return [];
}

/** A versioned filename stamp: YYYY-MM-DD-HHMM (local time). */
export function reportStamp(date = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}`
  );
}

/**
 * Count rows whose given field is null/empty across the merged set, for the
 * missing-by-field table. Pure helper; tolerant of a missing rows array.
 *
 * @param {Array<Object>|undefined} rows
 * @returns {{ sizeNull:number, oemNull:number, imageZero:number, prop65Null:number }}
 */
export function missingByField(rows) {
  const out = { sizeNull: 0, oemNull: 0, imageZero: 0, prop65Null: 0 };
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (r.size == null || r.size === "") out.sizeNull++;
    if (r.oem_number == null || r.oem_number === "") out.oemNull++;
    if (!Array.isArray(r.images) || r.images.length === 0) out.imageZero++;
    if (!r.prop65) out.prop65Null++;
  }
  return out;
}

/**
 * Build the reconciliation report from a single run's in-memory data.
 *
 * @param {{
 *   mergeStats: { total:number, matched:number, onlyInFinal:number, onlyInLimpio:number, distinctParents:number },
 *   validateSummary: { total:number, published:number, quarantined:number, byReason:{price:number,shipping:number} },
 *   fitmentSummary: { distinct:number, withEmDash?:number, makeOnly:number, blank?:number, multiMake:number, makes:Set<string>|string[], models?:Set<string>|string[], ambiguous:string[], multiMakeStrings?:string[] },
 *   categoryStats: { pairs:number },
 *   loadStats: Object,
 *   mergedRows?: Array<Object>,   // optional, drives missing-by-field
 *   dryRun: boolean,
 *   ranAt: string                  // ISO timestamp
 * }} data
 * @returns {{ markdown:string, csv:string, summaryLine:string }}
 */
export function buildReport({
  mergeStats = {},
  validateSummary = {},
  fitmentSummary = {},
  categoryStats = {},
  loadStats = {},
  mergedRows,
  dryRun = false,
  ranAt = new Date().toISOString(),
} = {}) {
  const mode = dryRun ? "DRY-RUN (no DB writes)" : "LIVE (catalog loaded)";

  // --- derived counts -------------------------------------------------------
  const total = mergeStats.total ?? validateSummary.total ?? 0;
  const matched = mergeStats.matched ?? 0;
  const orphan =
    (mergeStats.onlyInFinal ?? 0) + (mergeStats.onlyInLimpio ?? 0);
  const parents = mergeStats.distinctParents ?? loadStats?.counts?.products ?? 0;
  const variants = loadStats?.counts?.product_variants ?? total;
  const published = validateSummary.published ?? 0;
  const quarantined = validateSummary.quarantined ?? 0;
  const qPrice = validateSummary.byReason?.price ?? 0;
  const qShipping = validateSummary.byReason?.shipping ?? 0;

  const pairs =
    categoryStats.pairs ?? loadStats?.distinctCategoryPairs ?? 0;

  const makesList = toList(fitmentSummary.makes).sort();
  const modelsCount =
    fitmentSummary.models instanceof Set
      ? fitmentSummary.models.size
      : Array.isArray(fitmentSummary.models)
      ? fitmentSummary.models.length
      : fitmentSummary.modelsCount ?? 0;
  const makeOnly = fitmentSummary.makeOnly ?? 0;
  const multiMake = fitmentSummary.multiMake ?? 0;
  const ambiguous = toList(fitmentSummary.ambiguous);
  const multiMakeStrings = toList(fitmentSummary.multiMakeStrings).sort();

  const miss = missingByField(mergedRows);
  // Prefer the loader's actual placeholder count for image-0 if present.
  const imageZero =
    loadStats?.placeholdersUsed != null
      ? loadStats.placeholdersUsed
      : miss.imageZero;

  // ==========================================================================
  // MARKDOWN
  // ==========================================================================
  const lines = [];
  lines.push(`# Catalog ETL Reconciliation Report`);
  lines.push("");
  lines.push(`- **Run at:** ${ranAt}`);
  lines.push(`- **Mode:** ${mode}`);
  lines.push(`- **Source files:** \`bd/Catalogo_Truck_Final.xlsx\` (structure) + \`bd/Catalogo_Truck_Limpio.xlsx\` (rich)`);
  lines.push(`- **Target contract:** ${n(TARGET_VARIANTS)} variants / ${n(TARGET_PARENTS)} parents`);
  lines.push("");

  // --- Counts ---------------------------------------------------------------
  lines.push(`## Counts`);
  lines.push("");
  lines.push(`| Metric | Value | Target | Match |`);
  lines.push(`| --- | --- | --- | --- |`);
  lines.push(`| Total variants (merged) | ${n(total)} | ${n(TARGET_VARIANTS)} | ${total === TARGET_VARIANTS ? "OK" : "DELTA"} |`);
  lines.push(`| Matched (Final ∩ Limpio) | ${n(matched)} | ${n(TARGET_VARIANTS)} | ${matched === TARGET_VARIANTS ? "OK" : "DELTA"} |`);
  lines.push(`| Orphan (only-in-one) | ${n(orphan)} | 0 | ${orphan === 0 ? "OK" : "DELTA"} |`);
  lines.push(`| Distinct parents (products) | ${n(parents)} | ${n(TARGET_PARENTS)} | ${parents === TARGET_PARENTS ? "OK" : "DELTA"} |`);
  lines.push(`| Variants loaded | ${n(variants)} | ${n(TARGET_VARIANTS)} | ${variants === TARGET_VARIANTS ? "OK" : "DELTA"} |`);
  lines.push(`| Published | ${n(published)} | - | - |`);
  lines.push(`| Quarantined | ${n(quarantined)} | - | - |`);
  lines.push("");
  lines.push(`### Quarantine by reason (flag, never drop)`);
  lines.push("");
  lines.push(`| Reason | Count |`);
  lines.push(`| --- | --- |`);
  lines.push(`| price (price ≤ 0 / null) | ${n(qPrice)} |`);
  lines.push(`| shipping (weight/L/W/H ≤ 0 / null) | ${n(qShipping)} |`);
  lines.push("");

  // --- Missing-by-field -----------------------------------------------------
  lines.push(`## Missing-by-field (NOT quarantined — legitimately empty)`);
  lines.push("");
  lines.push(`| Field | Null/empty count | Policy |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(`| size | ${n(miss.sizeNull)} | publish (variant has no size) |`);
  lines.push(`| oem_number | ${n(miss.oemNull)} | publish (no OEM cross-ref) |`);
  lines.push(`| image-0 (placeholder used) | ${n(imageZero)} | publish (placeholder image attached) |`);
  lines.push(`| prop65 | ${n(miss.prop65Null)} | publish (no Prop 65 warning) |`);
  lines.push("");

  // --- Fitment --------------------------------------------------------------
  lines.push(`## Fitment normalization`);
  lines.push("");
  lines.push(`| Metric | Value | Expected |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(`| Distinct fitment strings | ${n(fitmentSummary.distinct ?? 0)} | ~172 |`);
  lines.push(`| Canonical makes | ${n(makesList.length)} | 10 |`);
  lines.push(`| Model tokens | ${n(modelsCount)} | ~40 |`);
  lines.push(`| Make-only strings (no model link) | ${n(makeOnly)} | ~13 |`);
  lines.push(`| Multi-make strings (cartesian) | ${n(multiMake)} | ~52 |`);
  lines.push(`| Ambiguous tokens | ${n(ambiguous.length)} | 0 |`);
  lines.push("");
  lines.push(`**Makes:** ${makesList.length ? makesList.join(", ") : "(none)"}`);
  lines.push("");
  if (ambiguous.length) {
    lines.push(`**Ambiguous make tokens (review):** ${[...new Set(ambiguous)].join(", ")}`);
    lines.push("");
  }

  // Multi-make review section (Pitfall 2 caveat + the strings LISTED).
  lines.push(`### Review fitment (cartesian over-attach)`);
  lines.push("");
  lines.push(
    `> **Pitfall 2 (honest v1 limitation):** Multi-make fitment strings list one ` +
      `shared model set across several makes (e.g. \`Freightliner, Peterbilt — Cascadia, 389\`). ` +
      `We cartesian-expand make × model, so a model can be attached to a make it ` +
      `does not actually belong to (over-attach). v1 accepts this — make/model ` +
      `granularity, no external validation feed. The ${n(multiMake)} multi-make ` +
      `strings are listed below for manual review/approval.`
  );
  lines.push("");
  if (multiMakeStrings.length) {
    lines.push(`The ${n(multiMakeStrings.length)} multi-make strings:`);
    lines.push("");
    for (const s of multiMakeStrings) lines.push(`- \`${s}\``);
  } else {
    lines.push(
      `_(The ${n(multiMake)} multi-make strings were counted but not captured for listing in this run.)_`
    );
  }
  lines.push("");

  // --- Category tree --------------------------------------------------------
  lines.push(`## Category tree`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Distinct (L1, L2) pairs observed | ${n(pairs)} |`);
  lines.push(`| Categories loaded (L1 + L2) | ${n(loadStats?.counts?.categories)} |`);
  lines.push("");
  lines.push(
    `> **Category delta note:** ${n(pairs)} distinct (L1,L2) pairs were observed ` +
      `in the data. Compare against the ~${TARGET_L2_PAIRS_NOTE} figure referenced ` +
      `in CONTEXT/RESEARCH (the 147-vs-169 delta). This delta is understood as ` +
      `source-data granularity, not an ETL bug — confirm it is acceptable for v1.`
  );
  lines.push("");

  // --- Load stats -----------------------------------------------------------
  lines.push(`## Load (rows sent per table)`);
  lines.push("");
  const c = loadStats?.counts ?? {};
  lines.push(`| Table | Rows |`);
  lines.push(`| --- | --- |`);
  lines.push(`| categories | ${n(c.categories)} |`);
  lines.push(`| truck_makes | ${n(c.truck_makes)} |`);
  lines.push(`| truck_models | ${n(c.truck_models)} |`);
  lines.push(`| products | ${n(c.products)} |`);
  lines.push(`| product_variants | ${n(c.product_variants)} |`);
  lines.push(`| product_images | ${n(c.product_images)} |`);
  lines.push(`| product_truck_compat | ${n(c.product_truck_compat)} |`);
  lines.push("");
  if (Array.isArray(loadStats?.orphanVariants) && loadStats.orphanVariants.length) {
    lines.push(`**Orphan variants (parent did not map, NOT inserted):** ${n(loadStats.orphanVariants.length)}`);
    lines.push("");
  }
  if (Array.isArray(loadStats?.parentsWithoutCategory) && loadStats.parentsWithoutCategory.length) {
    lines.push(`**Parents without a resolved category:** ${n(loadStats.parentsWithoutCategory.length)}`);
    lines.push("");
  }

  // --- Comparison vs target -------------------------------------------------
  lines.push(`## Comparison vs ~${n(TARGET_VARIANTS)} target`);
  lines.push("");
  lines.push(`- Merged total: **${n(total)}** vs target **${n(TARGET_VARIANTS)}** (${total === TARGET_VARIANTS ? "exact match" : `delta ${total - TARGET_VARIANTS}`}).`);
  lines.push(`- Matched: **${n(matched)}**, orphan: **${n(orphan)}**.`);
  lines.push(`- Distinct parents: **${n(parents)}** vs target **${n(TARGET_PARENTS)}** (${parents === TARGET_PARENTS ? "exact match" : `delta ${parents - TARGET_PARENTS}`}).`);
  lines.push("");
  lines.push(`---`);
  lines.push(`*Not financial advice. Generated by the offline catalog ETL — review and approve before Phase 3.*`);
  lines.push("");

  const markdown = lines.join("\n");

  // ==========================================================================
  // CSV (flat metric,value — diffable across runs)
  // ==========================================================================
  const csvRows = [
    ["metric", "value"],
    ["ran_at", ranAt],
    ["mode", dryRun ? "dry-run" : "live"],
    ["total_variants", total],
    ["matched", matched],
    ["orphan", orphan],
    ["distinct_parents", parents],
    ["variants_loaded", variants],
    ["published", published],
    ["quarantined", quarantined],
    ["quarantine_price", qPrice],
    ["quarantine_shipping", qShipping],
    ["missing_size", miss.sizeNull],
    ["missing_oem", miss.oemNull],
    ["image_zero_placeholder", imageZero],
    ["missing_prop65", miss.prop65Null],
    ["fitment_distinct", fitmentSummary.distinct ?? 0],
    ["fitment_makes", makesList.length],
    ["fitment_models", modelsCount],
    ["fitment_make_only", makeOnly],
    ["fitment_multi_make", multiMake],
    ["fitment_ambiguous", ambiguous.length],
    ["category_pairs", pairs],
    ["load_categories", c.categories ?? 0],
    ["load_truck_makes", c.truck_makes ?? 0],
    ["load_truck_models", c.truck_models ?? 0],
    ["load_products", c.products ?? 0],
    ["load_product_variants", c.product_variants ?? 0],
    ["load_product_images", c.product_images ?? 0],
    ["load_product_truck_compat", c.product_truck_compat ?? 0],
    ["orphan_variants", Array.isArray(loadStats?.orphanVariants) ? loadStats.orphanVariants.length : 0],
    ["placeholders_used", loadStats?.placeholdersUsed ?? 0],
  ];
  const csv = csvRows
    .map((r) => r.map((cell) => String(cell)).join(","))
    .join("\n");

  // ==========================================================================
  // One-line console summary
  // ==========================================================================
  const summaryLine =
    `[${dryRun ? "dry-run" : "live"}] total ${n(total)} | parents ${n(parents)} | ` +
    `published ${n(published)} | quarantined ${n(quarantined)} ` +
    `(price ${n(qPrice)} / shipping ${n(qShipping)}) | ` +
    `fitment: ${n(makesList.length)} makes / ${n(modelsCount)} models / ${n(multiMake)} multi-make | ` +
    `category pairs ${n(pairs)} | placeholders ${n(imageZero)}`;

  return { markdown, csv, summaryLine };
}

/**
 * Write the report to a versioned `<YYYY-MM-DD-HHMM>.md` + `.csv` pair.
 *
 * @param {{ markdown:string, csv:string }} report
 * @param {string} [dir="scripts/etl/data/reports"]
 * @param {Date} [date]
 * @returns {{ mdPath:string, csvPath:string }}
 */
export function writeReport(report, dir = "scripts/etl/data/reports", date = new Date()) {
  mkdirSync(dir, { recursive: true });
  const stamp = reportStamp(date);
  const mdPath = `${dir}/${stamp}.md`;
  const csvPath = `${dir}/${stamp}.csv`;
  writeFileSync(mdPath, report.markdown, "utf8");
  writeFileSync(csvPath, report.csv, "utf8");
  return { mdPath, csvPath };
}
