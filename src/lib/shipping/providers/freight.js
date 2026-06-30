import "server-only";

/**
 * Freight provider SEAM (CONTEXT: provider-ready, NOT final).
 *
 * LTL / oversized lines cannot be auto-rated against the parcel-carrier API, so
 * this stub returns a single "manual quote" pseudo-option. It exists behind a
 * swappable interface so a future REAL freight-API integration (e.g. an LTL
 * aggregator) drops in as a config/integration change, NOT a rewrite of 05-02.
 *
 * RETURN CONTRACT a future real provider MUST satisfy
 * (so the orchestrator + UI need no changes when swapped in):
 *   quote(freightLines, toAddress) -> Promise<null | {
 *     kind: "manual_quote" | "freight_rate",   // "freight_rate" once auto-priced
 *     label: string,                            // human-readable option label
 *     amount: number | null,                    // USD; null ONLY for manual_quote
 *     manual: boolean,                          // true => price comes later, out-of-band
 *     eta_days: number | null,                  // populated by a real provider
 *     lines: number[]                           // variant_ids this freight option covers
 *   }>
 * A real provider returns kind:"freight_rate", manual:false, with amount + eta_days set.
 */
export const freightProvider = {
  /**
   * @param {{variant_id:number}[]} freightLines - the LTL/oversized lines only
   * @returns {Promise<null | object>} null when there are no freight lines
   */
  async quote(freightLines /*, toAddress */) {
    const lines = Array.isArray(freightLines) ? freightLines : [];
    if (lines.length === 0) return null;

    return {
      kind: "manual_quote",
      label: "Freight (oversized) — we'll send you a freight quote",
      amount: null,
      manual: true,
      eta_days: null,
      lines: lines.map((l) => l.variant_id),
    };
  },
};
