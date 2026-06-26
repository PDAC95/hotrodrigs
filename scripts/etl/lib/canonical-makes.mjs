/**
 * Canonical truck-make list + raw->canonical mapping — Phase 02, Plan 02, Task 1.
 *
 * Fixed list of the 10 makes measured in the source `Compatible Trucks` data
 * (RESEARCH.md). `Chevrolet & GMC` is kept as a SINGLE canonical token to match
 * the source — never split on `&`. Pure, DB-free, no `src/` imports.
 */

/** The 10 canonical heavy-truck makes present in the source data. */
export const CANONICAL_MAKES = Object.freeze([
  "Chevrolet & GMC",
  "Ford",
  "Freightliner",
  "Hino",
  "International",
  "Kenworth",
  "Mack",
  "Peterbilt",
  "Volvo",
  "Western Star",
]);

// Lower-cased lookup: normalized raw token -> canonical string.
// Built once; includes a few defensive aliases for likely textual variants.
const LOOKUP = new Map();
for (const m of CANONICAL_MAKES) {
  LOOKUP.set(normalize(m), m);
}
// Defensive aliases (do not appear in current data, but cheap insurance).
const ALIASES = {
  chevy: "Chevrolet & GMC",
  chevrolet: "Chevrolet & GMC",
  gmc: "Chevrolet & GMC",
  "chevrolet/gmc": "Chevrolet & GMC",
  "chevrolet and gmc": "Chevrolet & GMC",
  intl: "International",
  western: "Western Star",
  "western-star": "Western Star",
};
for (const [k, v] of Object.entries(ALIASES)) {
  LOOKUP.set(normalize(k), v);
}

/**
 * Normalize a raw make token: trim, collapse internal whitespace, lower-case.
 * @param {string} s
 * @returns {string}
 */
function normalize(s) {
  return String(s).trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Map a raw make token to its canonical form.
 *
 * @param {string|null|undefined} raw
 * @returns {string|null} Canonical make string, or `null` if unknown/empty.
 *   Matching is exact + case-insensitive (with a small alias table). The
 *   `Chevrolet & GMC` token is preserved whole (never split on `&`).
 */
export function canonicalMake(raw) {
  if (raw == null) return null;
  const key = normalize(raw);
  if (!key) return null;
  return LOOKUP.get(key) ?? null;
}
