/**
 * Workbook reader for the offline catalog ETL — Phase 02, Plan 02, Task 1.
 *
 * Pure, DB-free SheetJS wrapper. Reads the two `bd/` source workbooks and
 * returns their rows as plain objects (UTF-8, blanks -> null). No `src/`
 * imports, no database access — runs only under `node` from `scripts/`.
 *
 * Note: under ESM, `xlsx` does not expose `readFile` (it has no bundled fs
 * adapter on the namespace), so we read the file ourselves with `node:fs` and
 * hand the buffer to `XLSX.read`. This is the portable cross-platform path.
 */
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

/**
 * Read one sheet of a workbook into an array of row objects.
 *
 * @param {string} path - Path to the .xlsx file.
 * @param {string} sheetName - Exact sheet name to read.
 * @param {{ raw?: boolean }} [opts] - `raw:true` keeps numeric cells numeric;
 *   default `raw:false` yields string-formatted cells (e.g. "$3.09").
 * @returns {Array<Object>} One object per row, blanks as null.
 */
export function readSheet(path, sheetName, { raw = false } = {}) {
  let buf;
  try {
    buf = readFileSync(path);
  } catch (err) {
    throw new Error(`Workbook not found or unreadable: ${path} (${err.message})`);
  }
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(
      `Sheet "${sheetName}" not found in ${path}. ` +
        `Available sheets: ${wb.SheetNames.join(", ")}`
    );
  }
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw });
}

/**
 * Read both catalog workbooks for the ETL.
 *
 * @param {string} [bdDir="bd"] - Directory holding the source workbooks.
 * @returns {{ finalRows: Array<Object>, limpioRows: Array<Object> }}
 *   `finalRows` = STRUCTURE source (Parent ID, L1/L2, size, pack);
 *   `limpioRows` = RICH source (MSRP, dims/weight, OEM, Prop 65, images...).
 */
export function readWorkbooks(bdDir = "bd") {
  const dir = String(bdDir).replace(/\/+$/, ""); // forward-slash joins, Windows-safe
  const finalRows = readSheet(
    `${dir}/Catalogo_Truck_Final.xlsx`,
    "Productos (variantes)"
  );
  const limpioRows = readSheet(
    `${dir}/Catalogo_Truck_Limpio.xlsx`,
    "Catalogo Limpio"
  );
  return { finalRows, limpioRows };
}
