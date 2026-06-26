/**
 * Declarative quarantine rules — Phase 02, Plan 03, Task 1 (CAT-06 / CAT-07).
 *
 * The LOCKED publication policy (CONTEXT): we FLAG bad rows, never DROP them.
 * A row that fails a load-bearing gate is loaded with `published=false` plus a
 * machine-readable reason; everything else publishes. The two gates are:
 *
 *   price    <= 0 / null              -> reason 'price'    (CAT-06, ~0 hits)
 *   weight/dim <= 0 / null            -> reason 'shipping' (CAT-07, ~9 hits)
 *
 * Explicitly NON-quarantining (these are legitimately empty in the data):
 *   size       null in 10,129 rows  -> publish
 *   oem_number null in  9,707 rows  -> publish
 *   images []  (~16 rows)           -> publish (loader attaches a placeholder)
 *
 * Pure: input -> output, no I/O, no `src/` imports. Reused by the Plan 04
 * dry-run report. A Zod schema declares the gates; failures map to reasons.
 */
import { z } from "zod";

/** A finite number strictly greater than 0 (rejects null, NaN, <= 0, strings). */
const positiveNumber = z
  .number({ invalid_type_error: "not-a-number" })
  .refine((n) => Number.isFinite(n) && n > 0, { message: "must be > 0" });

/**
 * The publication gate schema. Only the load-bearing fields are checked; every
 * other field on the merged row is intentionally ignored here.
 *
 * Each failing field is mapped to ONE quarantine reason:
 *   price            -> 'price'
 *   weight/L/W/H     -> 'shipping'
 */
const GATE_SCHEMA = z.object({
  price: positiveNumber,
  weight: positiveNumber,
  length: positiveNumber,
  width: positiveNumber,
  height: positiveNumber,
});

/** Map a failing gate field to its quarantine reason. */
const FIELD_REASON = {
  price: "price",
  weight: "shipping",
  length: "shipping",
  width: "shipping",
  height: "shipping",
};

/**
 * Validate ONE merged row against the publication gates.
 *
 * @param {Object} row - a merged row (Plan 02 shape).
 * @returns {{ published: boolean, reasons: string[] }}
 *   reasons is a de-duped, stable-ordered subset of ['price','shipping'].
 *   published === (reasons.length === 0).
 */
export function validateRow(row) {
  const result = GATE_SCHEMA.safeParse({
    price: row?.price,
    weight: row?.weight,
    length: row?.length,
    width: row?.width,
    height: row?.height,
  });

  if (result.success) {
    return { published: true, reasons: [] };
  }

  // Collect distinct reasons from the failing field paths.
  const reasonSet = new Set();
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    const reason = FIELD_REASON[field];
    if (reason) reasonSet.add(reason);
  }

  // Stable order: 'price' before 'shipping'.
  const reasons = ["price", "shipping"].filter((r) => reasonSet.has(r));
  return { published: reasons.length === 0, reasons };
}

/**
 * Validate ALL merged rows, annotating each with `published` +
 * `quarantine_reasons` and returning a summary.
 *
 * @param {Array<Object>} rows - merged rows.
 * @returns {{
 *   rows: Array<Object>,                         // each row + published + quarantine_reasons
 *   summary: {
 *     total: number,
 *     published: number,
 *     quarantined: number,
 *     byReason: { price: number, shipping: number }
 *   }
 * }}
 */
export function validateAll(rows) {
  const byReason = { price: 0, shipping: 0 };
  let published = 0;
  let quarantined = 0;

  const out = rows.map((row) => {
    const { published: ok, reasons } = validateRow(row);
    if (ok) {
      published++;
    } else {
      quarantined++;
      for (const r of reasons) byReason[r] = (byReason[r] ?? 0) + 1;
    }
    return { ...row, published: ok, quarantine_reasons: reasons };
  });

  return {
    rows: out,
    summary: {
      total: out.length,
      published,
      quarantined,
      byReason,
    },
  };
}
