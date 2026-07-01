import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/by-pi/:piId
 *
 * The confirmation page polls this after the post-payment redirect: 404 while the
 * webhook is still fulfilling ("Procesando…"), then the order once it exists.
 *
 * Uses the service-role admin client because guests have no session — the
 * confirmation page cannot rely on RLS. Security: this exposes an order keyed on
 * the PaymentIntent id, which is a high-entropy secret known only to the buyer's
 * session (returned from create-intent), so keying the receipt read on it is
 * acceptable. It NEVER accepts a user-supplied order_number (guessable). Phase 7
 * order history uses RLS scoped by user instead.
 */
export async function GET(req, { params }) {
  const { piId } = await params; // Next 15: params is async

  const admin = createAdminClient();

  // The fulfilled order (with its snapshot line items).
  const { data: order } = await admin
    .from("orders")
    .select(
      "order_number, status, subtotal, shipping, tax, total, ship_to_snapshot, created_at, order_items:order_items(name_snapshot, sku_snapshot, unit_price, quantity)"
    )
    .eq("stripe_pi_id", piId)
    .maybeSingle();

  if (order) {
    // The orders table has no email column; the buyer email lives on the staged
    // pending_orders row (create-intent step 9). Surface it so the confirmation
    // receipt's guest-account note can personalize (FIX-01).
    const pendingEmailRes = await admin
      .from("pending_orders")
      .select("email")
      .eq("stripe_pi_id", piId)
      .maybeSingle();

    return NextResponse.json({ ...order, email: pendingEmailRes.data?.email ?? null });
  }

  // No order yet. Surface a needs_refund state so the page can show the refunded
  // outcome instead of polling forever; otherwise 404 while still fulfilling.
  const { data: pending } = await admin
    .from("pending_orders")
    .select("status, order_number")
    .eq("stripe_pi_id", piId)
    .maybeSingle();

  if (pending?.status === "needs_refund") {
    return NextResponse.json(
      { status: "needs_refund", order_number: pending.order_number },
      { status: 200 }
    );
  }

  // Still pending (or unknown PI) — the page keeps polling / shows "Procesando…".
  return NextResponse.json({ status: "pending" }, { status: 404 });
}
