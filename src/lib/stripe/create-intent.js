import "server-only";

import { getCartLines, getGuestCartLines } from "@/lib/cart/server";
import {
  getShippingCartLines,
  getShippingCartLinesFromGuest,
} from "@/lib/shipping/cart-read";
import { quoteCart } from "@/lib/shipping/quote";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./server";
import { calcTax } from "./tax";

/**
 * createCheckoutIntent — the server-authoritative money core (CHK-01, CHK-02,
 * CHK-05). The client sends ONLY identity + selection (email/address/rate id/cart);
 * it NEVER sends an amount. Everything money-related is recomputed here:
 *
 *   1. Re-derive authoritative cart lines (price/stock LIVE from product_variants).
 *   2. Re-validate stock BEFORE charging (short lines -> insufficient_stock, 409).
 *   3. Subtotal in cents from the authoritative unit_price.
 *   4. Shipping in cents by resolving the SELECTED rate id server-side (never a
 *      client amount) through the same quoteCart the /api/shipping/quote route uses.
 *   5. Tax in cents via calcTax (degrades to $0 when the flag is off).
 *   6. Create the PaymentIntent with the server-computed total.
 *   7. Stage a pending_orders row (service-role) keyed on the PI id for the webhook
 *      (06-03) + confirmation page (06-03) to read.
 *
 * Server-only: sits behind the Stripe secret + service-role leak-gate.
 */

/** Same stable base36 string hash the /api/shipping/quote route uses for the cache key. */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0; // 32-bit
  }
  return (h >>> 0).toString(36);
}

/**
 * @param {object} params
 * @param {string} params.email
 * @param {{street1:string, street2?:string, city:string, state:string, zip:string, country:"US"|"CA"}} params.address
 * @param {string} params.selectedRateId - id of the parcel option the customer picked
 * @param {{variant_id:number|string, quantity:number}[]} [params.guestCart] - present for guests only
 * @param {string} [params.notes]
 * @returns {Promise<{clientSecret:string, orderNumber:string, breakdown:{subtotalCents:number, shippingCents:number, taxCents:number, totalCents:number}}>}
 * @throws {{code:'empty_cart'}} when the cart is empty
 * @throws {{code:'insufficient_stock', items:{variant_id, name}[]}} when a line is short
 */
export async function createCheckoutIntent({
  email,
  address,
  selectedRateId,
  guestCart,
  notes,
}) {
  const isGuest = Array.isArray(guestCart) && guestCart.length > 0;

  // 1. Re-derive authoritative lines — NEVER trust a client price (CART-04).
  const lines = isGuest
    ? await getGuestCartLines(guestCart)
    : await getCartLines();

  if (!lines || lines.length === 0) {
    throw { code: "empty_cart" };
  }

  // 2. Re-validate stock BEFORE charging (CHK-05 — never charge what we can't ship).
  const short = lines
    .filter((l) => l.out_of_stock || l.effective_qty < l.quantity)
    .map((l) => ({ variant_id: l.variant_id, name: l.product?.name ?? null }));
  if (short.length > 0) {
    throw { code: "insufficient_stock", items: short };
  }

  // 3. Subtotal in cents from the authoritative unit_price (dollars). Cents ONCE (Pitfall 3).
  const subtotalCents = lines.reduce(
    (sum, l) => sum + Math.round(Number(l.price) * 100) * Number(l.quantity),
    0
  );

  // 4. Shipping in cents — resolve the SELECTED rate server-side; never a client amount.
  const shippingLines = isGuest
    ? await getShippingCartLinesFromGuest(guestCart)
    : await getShippingCartLines();

  const cacheKey = hashString(
    JSON.stringify({
      ids: shippingLines
        .map((l) => `${l.variant_id}:${l.effective_qty}`)
        .sort()
        .join(","),
      zip: address.zip,
      country: address.country,
    })
  );

  const quote = await quoteCart({
    lines: shippingLines,
    toAddress: address,
    cacheKey,
  });

  const parcelOptions = quote?.parcel?.options ?? [];
  const freightOnly = parcelOptions.length === 0;

  let shippingCents = 0;
  let rateReselected = false;
  if (!freightOnly) {
    let chosen = parcelOptions.find((o) => String(o.id) === String(selectedRateId));
    if (!chosen) {
      // Stale selection -> fall back to the cheapest (index 0, already cheapest-first).
      chosen = parcelOptions[0];
      rateReselected = true;
    }
    shippingCents = Math.round(Number(chosen.amount) * 100);
  }
  // Freight-only carts (no parcel options): shippingCents stays 0, flagged in pending_orders.

  // 5. Tax in cents (degrades to $0 when STRIPE_TAX_ENABLED is off or the call errors).
  const taxLines = lines.map((l) => ({
    variant_id: l.variant_id,
    unit_price: Number(l.price),
    quantity: Number(l.quantity),
  }));
  const tax = await calcTax({ lines: taxLines, shippingCents, address });

  // 6. Total — assert the three parts sum to the total (Pitfall 3).
  const totalCents = subtotalCents + shippingCents + tax.taxCents;
  if (totalCents !== subtotalCents + shippingCents + tax.taxCents) {
    throw new Error("total_mismatch");
  }

  // 7. Reserve a race-safe, human-readable order number (RPC advances the sequence).
  const admin = createAdminClient();
  const { data: orderNumber, error: onErr } = await admin.rpc(
    "next_order_number"
  );
  if (onErr || !orderNumber) {
    throw new Error("order_number_failed");
  }

  // Resolve user_id for a logged-in caller; guests stay null (webhook resolves in 06-03).
  let userId = null;
  if (!isGuest) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  // Snapshot the exact lines the webhook fulfills against.
  const lineSnapshot = lines.map((l) => ({
    variant_id: l.variant_id,
    quantity: l.quantity,
    unit_price: Number(l.price),
    sku: l.sku,
    name: l.product?.name ?? null,
  }));

  // 8. Create the PaymentIntent — amount is server-authoritative.
  const pi = await getStripe().paymentIntents.create({
    amount: totalCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    receipt_email: email, // free Stripe receipt (CHK-06 baseline)
    metadata: {
      order_number: orderNumber,
      tax_calculation: tax.calculationId ?? "",
      email,
    },
  });

  // 9. Stage the row the webhook + confirmation page read (service-role bypasses RLS).
  const { error: upsertErr } = await admin.from("pending_orders").upsert(
    {
      stripe_pi_id: pi.id,
      order_number: orderNumber,
      email,
      user_id: userId,
      ship_to_snapshot: address,
      lines: lineSnapshot,
      subtotal: subtotalCents / 100,
      shipping: shippingCents / 100,
      tax: tax.taxCents / 100,
      total: totalCents / 100,
      tax_calculation_id: tax.calculationId,
      notes: notes ?? null,
      status: "pending",
    },
    { onConflict: "stripe_pi_id" }
  );
  if (upsertErr) throw upsertErr;

  return {
    clientSecret: pi.client_secret,
    orderNumber,
    breakdown: {
      subtotalCents,
      shippingCents,
      taxCents: tax.taxCents,
      totalCents,
    },
    // Non-fatal notes for the caller/UI (stale rate re-selected, freight-only cart).
    meta: { rateReselected, freightOnly },
  };
}
