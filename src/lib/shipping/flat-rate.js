import { FLAT_RATE_OVER, FLAT_RATE_TIERS } from "./config";

/**
 * Flat weight-tier fallback rate (RESEARCH Pattern 5). Used when EasyPost is
 * unavailable / returns no rates so the checkout always has an estimated option.
 *
 * Picks the first tier whose maxLb >= totalLb; above the last tier uses
 * FLAT_RATE_OVER. The returned option mirrors the EasyPost rate shape consumed in
 * 05-02 but is flagged `estimated: true` (no real carrier ETA).
 *
 * @param {number} totalLb - total cart weight in POUNDS
 * @returns {{id:string, label:string, amount:number, currency:string, estimated:boolean, eta_days:null}}
 */
export function flatRateForWeight(totalLb) {
  const lb = Number(totalLb) || 0;
  const tier = FLAT_RATE_TIERS.find((t) => lb <= t.maxLb);
  const amount = tier ? tier.amount : FLAT_RATE_OVER;

  return {
    id: "flat",
    label: "Estimated shipping",
    amount,
    currency: "USD",
    estimated: true,
    eta_days: null,
  };
}
