/**
 * Hybrid field-level merge on `Item No.` — Phase 02, Plan 02, Task 1.
 *
 * Joins the two source workbooks 1:1 on `Item No.` with the LOCKED precedence:
 *   structure  <- Final  (Parent ID/Name, L1, L2, Variant Size, Variant Pack)
 *   rich data  <- Limpio (MSRP, weight/dims, Ship Type/LTL/Oversized, OEM,
 *                         Prop 65, Images, Description)
 *   `Compatible Trucks` exists in both -> prefer Limpio, fall back to Final.
 *
 * Pure, DB-free. One output object per variant. No `src/` imports.
 */
import { readWorkbooks } from "./read-workbooks.mjs";

/**
 * Coerce a spreadsheet cell to a finite number, or null.
 * Strips `$` and thousands `,` (sheet_to_json with raw:false can yield "$3.09").
 *
 * @param {*} v
 * @returns {number|null}
 */
export function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Trim a cell to a non-empty string, or null. */
function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Collect B2B Image 1..10 from a Limpio row, dropping blanks. */
function collectImages(limpioRow) {
  if (!limpioRow) return [];
  const out = [];
  for (let i = 1; i <= 10; i++) {
    const v = str(limpioRow[`B2B Image ${i}`]);
    if (v) out.push(v);
  }
  return out;
}

/**
 * Merge Final (structure) and Limpio (rich) rows 1:1 on `Item No.`.
 *
 * @param {Array<Object>} finalRows
 * @param {Array<Object>} limpioRows
 * @returns {{ merged: Array<Object>, stats: Object }}
 *   merged: one object per variant with the field shape Plan 03 upserts.
 *   stats:  { total, matched, onlyInFinal, onlyInLimpio, distinctParents }.
 */
export function mergeRows(finalRows, limpioRows) {
  // O(1) join: index Limpio by trimmed Item No.
  const limpioByItem = new Map();
  for (const r of limpioRows) {
    const key = String(r["Item No."]).trim();
    limpioByItem.set(key, r);
  }

  const seenFinalItems = new Set();
  const matchedLimpioKeys = new Set();
  const parents = new Set();
  let matched = 0;
  let onlyInFinal = 0;

  const merged = finalRows.map((f) => {
    const itemNo = String(f["Item No."]).trim();
    seenFinalItems.add(itemNo);
    const l = limpioByItem.get(itemNo) ?? null;
    if (l) {
      matched++;
      matchedLimpioKeys.add(itemNo);
    } else {
      onlyInFinal++;
    }

    const parentId = str(f["Parent ID"]);
    if (parentId != null) parents.add(parentId);

    // Compatible Trucks: prefer Limpio, fall back to Final.
    const compatibleTrucks =
      str(l?.["Compatible Trucks"]) ?? str(f["Compatible Trucks"]);

    const shipType = str(l?.["Ship Type"]);
    const ltlFlag = l?.["LTL"] === "Yes" || shipType === "ltl";
    const oversized = l?.["Oversized or LTL Item"] === "Yes";
    const prop65 = !!str(l?.["Prop 65"]);

    return {
      item_no: itemNo,
      // structure <- Final
      parent_id: parentId,
      parent_name: str(f["Parent Name"]),
      section_l1: str(f["Section (L1)"]),
      subcategory_l2: str(f["Subcategory (L2)"]),
      size: str(f["Variant Size"]),
      pack: str(f["Variant Pack"]),
      barcode: str(f["Barcode No"]) ?? str(l?.["Barcode No"]),
      // rich <- Limpio (fall back to Final where the field also exists)
      description: str(l?.["Description"]) ?? str(f["Description"]),
      price: toNumber(l?.["MSRP"] ?? f["MSRP"]),
      weight: toNumber(l?.["Billable Weight (Packed Item)"] ?? f["Billable Weight (Packed Item)"]),
      length: toNumber(l?.["Length (Packed Item)"] ?? f["Length (Packed Item)"]),
      width: toNumber(l?.["Width (Packed Item)"] ?? f["Width (Packed Item)"]),
      height: toNumber(l?.["Height (Packed Item)"] ?? f["Height (Packed Item)"]),
      ship_type: shipType,
      ltl_flag: ltlFlag,
      oversized,
      oem_number: str(l?.["OEM No"]),
      prop65,
      images: collectImages(l),
      compatible_trucks: compatibleTrucks,
    };
  });

  // Limpio keys never seen on the Final side.
  let onlyInLimpio = 0;
  for (const key of limpioByItem.keys()) {
    if (!seenFinalItems.has(key)) onlyInLimpio++;
  }

  const stats = {
    total: merged.length,
    matched,
    onlyInFinal,
    onlyInLimpio,
    distinctParents: parents.size,
  };

  return { merged, stats };
}

/**
 * Convenience: read both workbooks and merge in one call.
 * @param {string} [bdDir="bd"]
 * @returns {{ merged: Array<Object>, stats: Object }}
 */
export function mergeFromWorkbooks(bdDir = "bd") {
  const { finalRows, limpioRows } = readWorkbooks(bdDir);
  return mergeRows(finalRows, limpioRows);
}
