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
      })),
      shipping_cost: { amount: shippingCents },
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

    return {
      taxCents: calculation.tax_amount_exclusive,
      calculationId: calculation.id,
    };
  } catch (err) {
    // Capability off / not registered / any error -> $0, never block checkout.
    console.error("[tax] degraded to $0:", err?.message);
    return { taxCents: 0, calculationId: null };
  }
}
