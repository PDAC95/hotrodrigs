import "server-only";

import { DEFAULT_BOX, LB_TO_OZ } from "./config";

/**
 * Combine non-freight shipping lines into a single EasyPost parcel
 * (RESEARCH Pattern 2 — naive single-box). Weight is summed across lines and
 * converted from POUNDS (catalog source unit) to OUNCES via LB_TO_OZ.
 *
 * Dims: length = max line length, width = max line width, height = sum of stacked
 * heights (height * effective_qty). Any 0/null dimension falls back to DEFAULT_BOX.
 *
 * @param {{weight:number, length:number, width:number, height:number, effective_qty:number}[]} parcelLines
 * @returns {{weight:number, length:number, width:number, height:number}} weight in OUNCES, dims in inches
 */
export function buildCombinedParcel(parcelLines) {
  const lines = Array.isArray(parcelLines) ? parcelLines : [];

  let totalLb = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let stackHeight = 0;

  for (const l of lines) {
    const qty = Number(l.effective_qty) || 0;
    totalLb += (Number(l.weight) || 0) * qty;
    maxLength = Math.max(maxLength, Number(l.length) || 0);
    maxWidth = Math.max(maxWidth, Number(l.width) || 0);
    stackHeight += (Number(l.height) || 0) * qty;
  }

  return {
    weight: totalLb * LB_TO_OZ, // lb -> oz (centralized conversion)
    length: maxLength > 0 ? maxLength : DEFAULT_BOX.length,
    width: maxWidth > 0 ? maxWidth : DEFAULT_BOX.width,
    height: stackHeight > 0 ? stackHeight : DEFAULT_BOX.height,
  };
}
