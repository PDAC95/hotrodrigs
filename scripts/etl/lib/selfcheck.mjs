#!/usr/bin/env node
/**
 * ETL transform-core self-check — Phase 02, Plan 02, Task 3.
 *
 * The pre-load gate: reads the real `bd/*.xlsx`, runs the DB-free merge +
 * fitment parse, and ASSERTS the measured contract from RESEARCH.md. Proves
 * merge (CAT-01), parent integrity (CAT-03), encoding cleanliness (CAT-02),
 * and fitment parsing (CAT-04) on actual data before any DB write.
 *
 * No database access. Run: `node scripts/etl/lib/selfcheck.mjs`
 * Exits 0 + "PASS" when the contract holds; non-zero + "FAIL: <reason>" on the
 * first load-bearing deviation (mirrors scripts/rls-isolation-test.mjs).
 */
import { readWorkbooks } from "./read-workbooks.mjs";
import { mergeRows } from "./merge.mjs";
import { summarizeFitment } from "./fitment.mjs";

// --- Measured contract (RESEARCH.md, inspected directly from bd/*.xlsx). -----
const TARGET = {
  total: 10849,
  matched: 10849,
  onlyInFinal: 0,
  onlyInLimpio: 0,
  distinctParents: 10263,
  distinctFitment: 172,
  makes: 10,
  multiMake: 52,
  models: 40, // soft target (printed, not hard-failed)
};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

/** Hard assertion: exit non-zero on mismatch. */
function assertEq(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} expected ${expected}, got ${actual}`);
  }
}

/** CAT-02: scan every string field for the U+FFFD replacement char. */
function countMojibake(rows) {
  let count = 0;
  for (const row of rows) {
    for (const v of Object.values(row)) {
      if (typeof v === "string") {
        if (v.includes("�")) count += (v.match(/�/g) || []).length;
      } else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string" && item.includes("�")) {
            count += (item.match(/�/g) || []).length;
          }
        }
      }
    }
  }
  return count;
}

function main() {
  const { finalRows, limpioRows } = readWorkbooks("bd");
  const { merged, stats } = mergeRows(finalRows, limpioRows);

  // --- CAT-01: merge counts (load-bearing). ---------------------------------
  assertEq(stats.total, TARGET.total, "merged total");
  assertEq(stats.matched, TARGET.matched, "matched");
  assertEq(stats.onlyInFinal, TARGET.onlyInFinal, "onlyInFinal");
  assertEq(stats.onlyInLimpio, TARGET.onlyInLimpio, "onlyInLimpio");

  // --- CAT-03: parent integrity (load-bearing). -----------------------------
  assertEq(stats.distinctParents, TARGET.distinctParents, "distinctParents");

  // --- CAT-02: mojibake gate (load-bearing). --------------------------------
  const mojibake = countMojibake(merged);
  assertEq(mojibake, 0, "mojibake (U+FFFD)");

  // --- CAT-04: fitment (makes + multiMake load-bearing; models/ambiguous soft).
  const distinctFitment = [...new Set(merged.map((r) => r.compatible_trucks ?? ""))];
  const fit = summarizeFitment(distinctFitment);
  assertEq(fit.distinct, TARGET.distinctFitment, "distinct fitment");
  assertEq(fit.makes.size, TARGET.makes, "canonical makes");
  assertEq(fit.multiMake, TARGET.multiMake, "multi-make strings");

  // Soft signals: surface deltas in the report (Plan 04), don't crash the gate.
  if (fit.models.size !== TARGET.models) {
    console.warn(
      `note: model-token count ${fit.models.size} (measured target ${TARGET.models}) — review in report`
    );
  }
  if (fit.ambiguous.length > 0) {
    console.warn(`note: ${fit.ambiguous.length} ambiguous make token(s): ${[...new Set(fit.ambiguous)].join(", ")}`);
  }

  // --- One-line summary. ----------------------------------------------------
  console.log(
    `total: ${stats.total} | parents: ${stats.distinctParents} | ` +
      `distinct-fitment: ${fit.distinct} | makes: ${fit.makes.size} | ` +
      `multi-make: ${fit.multiMake} | models: ${fit.models.size} | mojibake: ${mojibake}`
  );
  console.log("PASS: ETL transform core matches the measured contract.");
  process.exit(0);
}

try {
  main();
} catch (err) {
  fail(err.message);
}
