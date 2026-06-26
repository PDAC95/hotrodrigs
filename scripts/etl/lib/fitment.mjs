/**
 * Deterministic fitment parser — Phase 02, Plan 02, Task 2 (CAT-04).
 *
 * Turns a raw `Compatible Trucks` free-text string into canonical
 * make/model relations. Format (RESEARCH.md):
 *
 *   Make[, Make...] — model, model...
 *
 *   separator     = em-dash U+2014 ("—")   (NEVER hyphen `-` or en-dash U+2013)
 *   sub-separator = comma
 *
 * Multi-make strings share one model list across makes -> cartesian expand
 * (each make x each model). Make-only strings create NO relation (no model to
 * link), but `rawBackup` is always preserved. Unknown makes are captured in
 * `ambiguous`, never silently dropped. Pure & deterministic — no I/O.
 */
import { canonicalMake } from "./canonical-makes.mjs";

const EM_DASH = "—"; // — (U+2014). The ONLY make|model separator.

/**
 * Parse one raw `Compatible Trucks` string.
 *
 * @param {string|null|undefined} raw
 * @returns {{
 *   fitsAll: boolean,
 *   relations: Array<{ make: string, model: string }>,
 *   rawBackup: string|null,
 *   ambiguous: Array<string>
 * }}
 */
export function parseFitment(raw) {
  const s = raw == null ? "" : String(raw).trim();

  // 1. Empty.
  if (s === "") {
    return { fitsAll: false, relations: [], rawBackup: null, ambiguous: [] };
  }

  // 2. Defensive fits-all branch (0 hits expected on current data, must exist).
  if (/\b(all|universal|todos)\b/i.test(s)) {
    return { fitsAll: true, relations: [], rawBackup: s, ambiguous: [] };
  }

  const ambiguous = [];
  const relations = [];

  // 3. Split on em-dash ONLY. Assert <= 2 parts.
  const parts = s.split(EM_DASH);
  if (parts.length > 2) {
    // Unexpected multi-dash shape -> capture whole string, no relations.
    ambiguous.push(s);
    return { fitsAll: false, relations: [], rawBackup: s, ambiguous };
  }
  const left = parts.length === 2 ? parts[0] : s; // no em-dash -> make-only
  const right = parts.length === 2 ? parts[1] : "";

  // 4. Makes -> canonical. Unknown make tokens are captured as ambiguous.
  const makeTokens = left
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const makes = [];
  for (const tok of makeTokens) {
    const canon = canonicalMake(tok);
    if (canon == null) ambiguous.push(tok);
    else makes.push(canon);
  }

  // 5. Models.
  const models = right
    ? right
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // 6. Cartesian: make x model. Make-only (no models) -> no relation.
  for (const make of makes) {
    for (const model of models) {
      relations.push({ make, model });
    }
  }

  return { fitsAll: false, relations, rawBackup: s, ambiguous };
}

/**
 * Summarize a set of distinct fitment strings (self-check + Plan 04 report).
 *
 * @param {Array<string|null|undefined>} strings - distinct fitment values.
 * @returns {{
 *   distinct: number,
 *   withEmDash: number,
 *   makeOnly: number,
 *   blank: number,
 *   multiMake: number,
 *   makes: Set<string>,
 *   models: Set<string>,
 *   ambiguous: Array<string>
 * }}
 */
export function summarizeFitment(strings) {
  const distinctSet = new Set(strings.map((s) => (s == null ? "" : String(s).trim())));
  let withEmDash = 0;
  let makeOnly = 0;
  let blank = 0;
  let multiMake = 0;
  const makes = new Set();
  const models = new Set();
  const ambiguous = [];

  for (const s of distinctSet) {
    if (s === "") {
      blank++;
      continue;
    }
    if (s.includes(EM_DASH)) withEmDash++;
    else makeOnly++;

    // Count multi-make on the raw left side (before canonicalization).
    const left = s.includes(EM_DASH) ? s.split(EM_DASH)[0] : s;
    const makeTokens = left.split(",").map((t) => t.trim()).filter(Boolean);
    if (makeTokens.length > 1) multiMake++;

    const parsed = parseFitment(s);
    for (const rel of parsed.relations) {
      makes.add(rel.make);
      models.add(rel.model);
    }
    // Canonical makes from make-only strings (no relations) still count.
    if (parsed.relations.length === 0 && parsed.ambiguous.length === 0) {
      for (const tok of makeTokens) {
        const canon = canonicalMake(tok);
        if (canon) makes.add(canon);
      }
    }
    for (const a of parsed.ambiguous) ambiguous.push(a);
  }

  return {
    distinct: distinctSet.size,
    withEmDash,
    makeOnly,
    blank,
    multiMake,
    makes,
    models,
    ambiguous,
  };
}
