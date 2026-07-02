import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAddress } from "@/lib/shipping/address";
import { createCheckoutIntent } from "@/lib/stripe/create-intent";

/**
 * POST /api/stripe/create-payment-intent
 *
 * Mirrors the /api/shipping/quote server-only wall (force-dynamic, zod body,
 * server-only imports). The client sends ONLY identity + selection — email,
 * address, selected_rate_id (+ guest_cart for guests, + optional notes). It NEVER
 * sends an amount/price/tax (CART-04 discipline extended to payment, CHK-01).
 * The Stripe secret client + service-role stay server-side; nothing here is
 * bundled to the client (check:leak).
 *
 * force-dynamic: the PaymentIntent + pending_orders row are per-request and must
 * never be served from the route cache.
 */
export const dynamic = "force-dynamic";

// Locked geographic scope: US + CA (CONTEXT). country enum blocks anything else at 400.
const bodySchema = z.object({
  email: z.string().email(),
  // Recipient / customer name captured at checkout — persisted into the
  // ship_to_snapshot so the admin can contact the buyer by name (not just email).
  name: z.string().min(1).max(200),
  address: z.object({
    street1: z.string().min(1),
    street2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(1),
    country: z.enum(["US", "CA"]),
  }),
  selected_rate_id: z.string().min(1),
  // Present when the caller is a guest; logged-in callers omit it (server reads RLS cart).
  guest_cart: z
    .array(
      z.object({
        variant_id: z.union([z.number(), z.string()]),
        quantity: z.number(),
      })
    )
    .optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req) {
  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!parsed.success) {
    // Includes out-of-area (country not US/CA) — the enum rejects it here.
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { email, name, address, selected_rate_id, guest_cart, notes } =
    parsed.data;

  // Never read a client amount/price/tax — none exist in the schema.

  // Verify the destination first. Unverified -> 200 {verified:false, suggestion}
  // (same shape as the quote route so the UI reuses its inline suggestion handling).
  // Do NOT create a PaymentIntent for an unverified address.
  const v = await verifyAddress(address);
  if (!v.verified) {
    return NextResponse.json({
      verified: false,
      suggestion: v.suggestion,
      errors: v.errors,
    });
  }

  try {
    const { clientSecret, orderNumber, breakdown } = await createCheckoutIntent({
      email,
      customerName: name,
      address,
      selectedRateId: selected_rate_id,
      guestCart: guest_cart,
      notes,
    });

    return NextResponse.json({
      verified: true,
      clientSecret,
      orderNumber,
      breakdown,
    });
  } catch (err) {
    if (err?.code === "insufficient_stock") {
      return NextResponse.json(
        { error: "insufficient_stock", items: err.items },
        { status: 409 }
      );
    }
    if (err?.code === "empty_cart") {
      return NextResponse.json({ error: "empty_cart" }, { status: 400 });
    }
    // Unexpected (Stripe error, DB error, etc.).
    console.error("[create-payment-intent] failed:", err?.message);
    return NextResponse.json({ error: "intent_failed" }, { status: 500 });
  }
}
