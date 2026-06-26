#!/usr/bin/env node
/**
 * Catalog ETL entrypoint — Phase 02, Plan 04, Task 2.
 *
 * The single command that runs the whole offline pipeline end-to-end:
 *
 *   read workbooks -> merge (Final + Limpio) -> validate/quarantine ->
 *   encoding assert -> normalize truck fitment -> load (idempotent upsert) ->
 *   reconciliation report (Markdown + CSV) + printed summary.
 *
 * Modes:
 *   `--dry-run`  parse/validate/normalize/report with NO database writes.
 *                Still emits the report — this is the artifact the user reviews
 *                at the manual acceptance gate (CONTEXT).
 *   (no flag)    LIVE: loads the catalog into Supabase via the service-role
 *                client. Idempotent — re-running leaves row counts unchanged.
 *
 * Run:
 *   npm run etl:dry      # node --env-file=.env.local scripts/etl/import-catalog.mjs --dry-run
 *   npm run etl          # node --env-file=.env.local scripts/etl/import-catalog.mjs
 *
 * NEVER import this from `src/app` — it is offline, service-role, and would
 * trip the leak gate (`npm run check:leak`).
 */
import { readWorkbooks } from "./lib/read-workbooks.mjs";
import { mergeRows } from "./lib/merge.mjs";
import { validateAll } from "./lib/validate.mjs";
import { parseFitment, summarizeFitment } from "./lib/fitment.mjs";
import { loadCatalog, createOfflineAdminClient } from "./lib/load.mjs";
import { buildReport, writeReport } from "./lib/report.mjs";

const EM_DASH = "—";

/** CAT-02 encoding assert (Pattern 5): fail loudly on any U+FFFD across strings. */
function assertNoMojibake(rows) {
  let count = 0;
  const samples = [];
  for (const row of rows) {
    for (const v of Object.values(row)) {
      const scan = (s) => {
        if (typeof s === "string" && s.includes("�")) {
          count += (s.match(/�/g) || []).length;
          if (samples.length < 5) samples.push(s);
        }
      };
      if (Array.isArray(v)) v.forEach(scan);
      else scan(v);
    }
  }
  if (count > 0) {
    throw new Error(
      `encoding assert (CAT-02): found ${count} U+FFFD replacement char(s). ` +
        `Sample(s): ${samples.join(" | ")}`
    );
  }
}

/** Distinct multi-make raw strings (left side has >1 make), for the report. */
function collectMultiMakeStrings(distinctStrings) {
  const out = new Set();
  for (const s of distinctStrings) {
    if (!s) continue;
    const left = s.includes(EM_DASH) ? s.split(EM_DASH)[0] : s;
    const tokens = left.split(",").map((t) => t.trim()).filter(Boolean);
    if (tokens.length > 1) out.add(s);
  }
  return [...out];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ranAt = new Date().toISOString();
  console.log(`Catalog ETL — mode: ${dryRun ? "DRY-RUN (no DB writes)" : "LIVE"}`);

  // 1. read -> merge ---------------------------------------------------------
  const { finalRows, limpioRows } = readWorkbooks("bd");
  const { merged, stats: mergeStats } = mergeRows(finalRows, limpioRows);
  console.log(`  merged ${merged.length} variants / ${mergeStats.distinctParents} parents`);

  // 2. encoding assert (fail loudly before any DB write) ---------------------
  assertNoMojibake(merged);

  // 3. validate / quarantine -------------------------------------------------
  const validated = validateAll(merged);
  console.log(
    `  validated: ${validated.summary.published} published / ` +
      `${validated.summary.quarantined} quarantined ` +
      `(price ${validated.summary.byReason.price} / shipping ${validated.summary.byReason.shipping})`
  );

  // 4. fitment normalization -------------------------------------------------
  // Distinct strings drive the summary; per-parent parse drives the load.
  const distinctFitment = [...new Set(merged.map((r) => r.compatible_trucks ?? ""))];
  const fitmentSummary = summarizeFitment(distinctFitment);
  fitmentSummary.multiMakeStrings = collectMultiMakeStrings(distinctFitment);

  // Build fitmentByParent: one parsed fitment per distinct parent_id. All
  // variants of a parent share a fitment string; take the first non-empty.
  const fitmentByParent = new Map();
  for (const r of merged) {
    if (r.parent_id == null) continue;
    if (!fitmentByParent.has(r.parent_id)) {
      fitmentByParent.set(r.parent_id, r.compatible_trucks ?? null);
    } else if (!fitmentByParent.get(r.parent_id) && r.compatible_trucks) {
      fitmentByParent.set(r.parent_id, r.compatible_trucks);
    }
  }
  for (const [parentId, raw] of fitmentByParent) {
    fitmentByParent.set(parentId, parseFitment(raw));
  }
  console.log(
    `  fitment: ${fitmentSummary.makes.size} makes / ${fitmentSummary.models.size} models / ` +
      `${fitmentSummary.multiMake} multi-make (${fitmentSummary.multiMakeStrings.length} listed)`
  );

  // 5. load (or dry-run short-circuit) --------------------------------------
  const admin = dryRun ? null : createOfflineAdminClient();
  const loadStats = await loadCatalog(admin, {
    merged,
    validated,
    fitmentByParent,
    dryRun,
  });
  console.log(
    `  loaded (rows sent): products ${loadStats.counts.products} / ` +
      `variants ${loadStats.counts.product_variants} / ` +
      `images ${loadStats.counts.product_images} / ` +
      `compat ${loadStats.counts.product_truck_compat}`
  );

  // 6. report ----------------------------------------------------------------
  const report = buildReport({
    mergeStats,
    validateSummary: validated.summary,
    fitmentSummary,
    categoryStats: { pairs: loadStats.distinctCategoryPairs },
    loadStats,
    mergedRows: merged,
    dryRun,
    ranAt,
  });
  const { mdPath, csvPath } = writeReport(report);

  console.log("");
  console.log(report.summaryLine);
  console.log(`Report: ${mdPath}`);
  console.log(`        ${csvPath}`);
  if (dryRun) {
    console.log("DRY-RUN complete — no rows written. Review the report above.");
  } else {
    console.log("LIVE load complete — re-run to prove idempotency (counts must not grow).");
  }
}

main().catch((err) => {
  console.error(`ETL FAILED: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
