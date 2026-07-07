// scripts/sass-css-diff.mjs — Phase 10 compiled-CSS diff gate (throwaway — 10-04 deletes it).
//
// Compiles the MIGRATED Sass tree with the SAME pinned compiler that produced the
// baseline (scripts/sass-artifacts/before.css, sass@1.101.0 — identical formatting),
// then diffs the two outputs. EXACTLY two differences are whitelisted, both
// cascade-neutral and both reported by 10-02's gate:
//
//   1. The plain-CSS Google-Fonts `@import url("https://fonts.googleapis.com/...")`
//      hoisted from line 42 to line 1. Under the @use module system the variable
//      module's CSS is emitted at first-load position; the hoist crosses ONLY
//      comment lines (baseline lines 1-41 are comments), so a comments-stripped
//      normalization sees zero movement. Cascade-neutrality is ASSERTED, not
//      assumed: on BOTH raw files, everything before the @import must strip down
//      to whitespace (comments only), and the @import must appear exactly once.
//
//   2. One selector-list INTERNAL swap at baseline line ~7236:
//        .box-shadow-lg, .submenus-submenu, .common-dropdown
//      becomes
//        .box-shadow-lg, .common-dropdown, .submenus-submenu
//      (the utilities/_extend.scss co-location changed @extend registration order).
//      The order of complex selectors WITHIN one selector list has no cascade
//      effect — all three share the single declaration block. Normalized by
//      sorting ONLY a selector list whose member set is exactly these three.
//
// ANY other difference fails the gate (exit 1). Never widen the whitelist without
// writing a cascade-neutrality proof into this comment block.
//
// Usage: node scripts/sass-css-diff.mjs

import { execSync } from "node:child_process";
import fs from "node:fs";

const BEFORE = "scripts/sass-artifacts/before.css";
const AFTER = "scripts/sass-artifacts/after.css";
const ENTRY = "public/assets/sass/main.scss";

const FONT_IMPORT_RE = /^@import url\("https:\/\/fonts\.googleapis\.com\/[^"]*"\);$/;

// The ONE whitelisted selector set (sorted). Nothing else gets normalized.
const SWAP_SET = [".box-shadow-lg", ".common-dropdown", ".submenus-submenu"];

function fail(msg) {
  console.error(`\nsass-css-diff: FAIL — ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Compile the migrated tree with the pinned compiler (same as the baseline).
// ---------------------------------------------------------------------------
if (!fs.existsSync(BEFORE)) fail(`${BEFORE} missing — run the 10-01 baseline capture first.`);
console.log(`sass-css-diff: compiling ${ENTRY} with pinned sass@1.101.0 ...`);
// execSync is safe here: the command is built ONLY from the hardcoded constants
// above (no argv/env/user input), and npx requires a shell on Windows.
execSync(`npx sass@1.101.0 --no-source-map ${ENTRY} ${AFTER}`, { stdio: "inherit" });

const rawBefore = fs.readFileSync(BEFORE, "utf8");
const rawAfter = fs.readFileSync(AFTER, "utf8");

// ---------------------------------------------------------------------------
// 2. Whitelist 1 assertion — the @import hoist crosses ONLY comments.
// ---------------------------------------------------------------------------
function stripComments(text) {
  // Expanded dart-sass output never emits /* inside strings/url() here; a plain
  // non-greedy strip is safe for this artifact (verified against before.css).
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function assertImportHoistNeutral(raw, label) {
  const lines = raw.split(/\r?\n/);
  const hits = lines
    .map((l, i) => ({ l: l.trim(), i }))
    .filter(({ l }) => FONT_IMPORT_RE.test(l));
  if (hits.length !== 1) {
    fail(`${label}: expected exactly 1 Google-Fonts @import, found ${hits.length}`);
  }
  const idx = hits[0].i;
  const prefix = lines.slice(0, idx).join("\n");
  if (stripComments(prefix).trim() !== "") {
    fail(
      `${label}: content OTHER than comments precedes the @import (line ${idx + 1}) — ` +
        "the hoist would NOT be cascade-neutral."
    );
  }
  return idx + 1; // 1-based line number for the report
}

const importLineBefore = assertImportHoistNeutral(rawBefore, "before.css");
const importLineAfter = assertImportHoistNeutral(rawAfter, "after.css");

// ---------------------------------------------------------------------------
// 3. Normalize both sides: strip comments, drop blank lines, canonicalize the
//    ONE whitelisted selector list. Everything else must match byte-for-byte.
// ---------------------------------------------------------------------------
let swapNormalizations = { before: [], after: [] };

function normalize(raw, side) {
  const lines = stripComments(raw)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "");
  return lines.map((line, i) => {
    const m = line.match(/^(\s*)(.+?)\s*\{$/);
    if (!m) return line;
    const parts = m[2].split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length !== SWAP_SET.length) return line;
    const sorted = [...parts].sort();
    if (sorted.join("|") !== SWAP_SET.join("|")) return line; // not the whitelisted set
    if (parts.join(", ") !== sorted.join(", ")) {
      swapNormalizations[side].push({ line: i + 1, original: parts.join(", ") });
    }
    return `${m[1]}${sorted.join(", ")} {`;
  });
}

const normBefore = normalize(rawBefore, "before");
const normAfter = normalize(rawAfter, "after");

// ---------------------------------------------------------------------------
// 4. Compare. Any residual difference = hard fail with a bounded report.
// ---------------------------------------------------------------------------
const max = Math.max(normBefore.length, normAfter.length);
const diffs = [];
for (let i = 0; i < max; i++) {
  if (normBefore[i] !== normAfter[i]) {
    diffs.push({ line: i + 1, before: normBefore[i] ?? "<EOF>", after: normAfter[i] ?? "<EOF>" });
    if (diffs.length >= 40) break;
  }
}

if (diffs.length > 0) {
  console.error(
    `\nsass-css-diff: ${diffs.length}${diffs.length >= 40 ? "+" : ""} non-whitelisted ` +
      `difference(s) after normalization (normalized lines: before=${normBefore.length}, after=${normAfter.length}):`
  );
  for (const d of diffs.slice(0, 20)) {
    console.error(`  @ normalized line ${d.line}`);
    console.error(`    - ${d.before}`);
    console.error(`    + ${d.after}`);
  }
  fail("compiled CSS diverges from the baseline beyond the 2 whitelisted trivia.");
}

// ---------------------------------------------------------------------------
// 5. PASS summary — explain the residue the whitelist absorbed.
// ---------------------------------------------------------------------------
console.log("\nsass-css-diff: PASS — compiled CSS matches the baseline.");
console.log(`  normalized lines compared: ${normBefore.length} (identical)`);
console.log("  whitelisted residue absorbed (both cascade-neutral):");
console.log(
  `    1. Google-Fonts @import hoist: before.css line ${importLineBefore} -> after.css line ${importLineAfter}` +
    " (crossed comments only — asserted on both raw files)"
);
const swaps = [...swapNormalizations.before, ...swapNormalizations.after];
if (swaps.length === 0) {
  console.log("    2. selector-list swap: NOT present (minifier/compiler already canonical)");
} else {
  for (const side of ["before", "after"]) {
    for (const s of swapNormalizations[side]) {
      console.log(
        `    2. selector-list order in ${side}.css @ normalized line ${s.line}: "${s.original}" -> sorted canonical`
      );
    }
  }
}
