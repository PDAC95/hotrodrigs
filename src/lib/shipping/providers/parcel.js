import "server-only";

import { easypost } from "../easypost-client";
import { buildCombinedParcel } from "../parcel-builder";
import { ORIGIN_ADDRESS } from "../config";

/**
 * Parcel provider — turns the non-freight cart lines into a single combined box,
 * rates it against EasyPost, and returns a CURATED top 3-4 list (RESEARCH
 * Pattern 3 / CONTEXT: curated, cheapest preselected). Raw rate passthrough —
 * NO markup / handling fee (CONTEXT).
 *
 * Server-only: this sits behind the EasyPost client leak-gate.
 */

/**
 * Curate the raw EasyPost rates down to a clean ≤4 list the UI preselects from.
 *
 * Strategy: keep the cheapest, the fastest (lowest est_delivery_days), plus the
 * next 1-2 cheapest; de-dupe by rate id; cap at 4; then re-sort the final picks
 * by amount ascending so index 0 is the CHEAPEST (UI preselects index 0).
 *
 * @param {Array<{id:string, carrier:string, service:string, rate:string, currency:string, est_delivery_days?:number, delivery_days?:number}>} rates
 * @returns {Array<{id:string, label:string, carrier:string, service:string, amount:number, currency:string, eta_days:number|null}>}
 */
function curateRates(rates) {
  const list = Array.isArray(rates) ? rates : [];
  if (list.length === 0) return [];

  // Cheapest first.
  const byPrice = [...list].sort((a, b) => Number(a.rate) - Number(b.rate));

  // Fastest by est_delivery_days (fall back to delivery_days); unknown ETAs sort last.
  const etaOf = (r) =>
    r.est_delivery_days ?? r.delivery_days ?? Number.POSITIVE_INFINITY;
  const byEta = [...list].sort((a, b) => etaOf(a) - etaOf(b));

  const picks = [];
  const seen = new Set();
  const add = (r) => {
    if (r && !seen.has(r.id)) {
      seen.add(r.id);
      picks.push(r);
    }
  };

  add(byPrice[0]); // cheapest
  add(byEta[0]); // fastest
  add(byPrice[1]); // next cheapest
  add(byPrice[2]); // and the next

  const capped = picks.slice(0, 4);

  // Re-sort the final picks by amount asc -> cheapest is first (UI preselects 0).
  capped.sort((a, b) => Number(a.rate) - Number(b.rate));

  return capped.map((r) => ({
    id: r.id,
    label: `${r.carrier} ${r.service}`,
    carrier: r.carrier,
    service: r.service,
    amount: Number(r.rate),
    currency: r.currency,
    eta_days: r.est_delivery_days ?? r.delivery_days ?? null,
  }));
}

export const parcelProvider = {
  /**
   * @param {object[]} parcelLines - non-freight shipping lines (already partitioned)
   * @param {object} toAddress - EasyPost-shaped destination address
   * @returns {Promise<{estimated:false, options:object[]}>}
   */
  async quote(parcelLines, toAddress) {
    const lines = Array.isArray(parcelLines) ? parcelLines : [];
    // A freight-only cart still gets a valid (empty) parcel response.
    if (lines.length === 0) return { estimated: false, options: [] };

    const parcel = buildCombinedParcel(lines);
    const shipment = await easypost.Shipment.create({
      from_address: ORIGIN_ADDRESS,
      to_address: toAddress,
      parcel,
    });

    // Empty/undefined rates -> [] (soft case for quoteCart's caller); never throw.
    return { estimated: false, options: curateRates(shipment.rates) };
  },
};
