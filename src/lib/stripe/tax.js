import "server-only";

import { getStripe } from "./server";

/**
 * Stripe Tax seam, flagged behind STRIPE_TAX_ENABLED (CHK-02).
 *
 * calcTax computes sales tax in CENTS for a set of authoritative cart lines +
 * shipping. It mirrors the EasyPost key-gate: when the Stripe Tax capability is
 * NOT enabled (STRIPE_TAX_ENABLED unset/false) — or the calculation call errors
 * for ANY reason — it degrades to $0 and NEVER throws, so checkout is never
 * blocked on tax. When the flag is on and the call succeeds, tax comes straight
 * from Stripe Tax (no hand-rolled rates).
 *
 * Server-only: the Stripe secret client sits behind the leak-gate.
 */

/**
 * @param {object} params
 * @param {{variant_id:number|string, unit_price:number, quantity:number}[]} params.lines
 *   Authoritative lines — unit_price is in DOLLARS (from product_variants).
 * @param {number} params.shippingCents - shipping total in cents (taxed as shipping_cost).
 * @param {{street1:string, city:string, state:string, zip:string, country:string}} params.address
 * @returns {Promise<{taxCents:number, calculationId:string|null}>}
 */
export async function calcTax({ lines, shippingCents, address }) {
  // Capability off — degrade to $0 immediately (mirrors the EasyPost key-gate).
  if (process.env.STRIPE_TAX_ENABLED !== "true") {
    return { taxCents: 0, calculationId: null };
  }

  try {
    const calculation = await getStripe().tax.calculations.create({
      currency: "usd",
      line_items: (lines || []).map((l) => ({
        reference: String(l.variant_id),
        // Cents ONCE (Pitfall 3): round the unit price to cents, then multiply.
        amount: Math.round(Number(l.unit_price) * 100) * Number(l.quantity),
        quantity: Number(l.quantity),
        // Pin exclusive semantics in code: this seam reads ONLY
        // tax_amount_exclusive. If the Dashboard default were "inclusive",
        // that field would read 0 and tax would silently vanish from the
        // charged total — explicit tax_behavior makes the read immune to
        // Dashboard state.
        tax_behavior: "exclusive",
      })),
      shipping_cost: { amount: shippingCents, tax_behavior: "exclusive" },
      customer_details: {
        address: {
          line1: address.street1,
          city: address.city,
          state: address.state,
          postal_code: address.zip,
          country: address.country,
        },
        address_source: "shipping",
      },
      expand: ["line_items.data.tax_breakdown"],
    });

    // Loud $0 tripwire (TAX-03): Stripe NEVER errors for an unregistered
    // jurisdiction — it succeeds with tax_amount_exclusive: 0 and
    // taxability_reason: "not_collecting". This error-level log is the ONLY
    // signal of that registration/config gap. Reading the log:
    //   - "not_collecting"  -> registration/config gap (fix Dashboard settings)
    //   - a legit no-sales-tax state (OR/MT/NH/DE/AK) also yields $0 with a
    //     different reason — the purchase must still complete either way.
    // This is a tripwire, NEVER a throw: log loudly, don't block checkout.
    if (calculation.tax_amount_exclusive === 0) {
      const reasons = (calculation.tax_breakdown ?? [])
        .map((b) => b.taxability_reason)
        .join(",");
      console.error(
        `[tax] FLAG-ON $0 RESULT — likely missing registration for ${address?.state ?? ""} ${address?.country ?? ""} (calc ${calculation.id}); taxability: ${reasons}`
      );
    }

    return {
      taxCents: calculation.tax_amount_exclusive,
      calculationId: calculation.id,
    };
  } catch (err) {
    // A calculation ERROR while the flag is on (missing head office, no
    // default tax code, customer_tax_location_invalid, ...) is equally a loud
    // event — same grep-able [tax] family. Still degrade to $0, never block
    // checkout (never throws).
    console.error(
      `[tax] degraded to $0 (calculation error) for ${address?.state ?? ""} ${address?.country ?? ""}:`,
      err?.message
    );
    return { taxCents: 0, calculationId: null };
  }
}
