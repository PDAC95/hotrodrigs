import "server-only"; // only reachable from the verified webhook route

import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderFromIntent } from "@/lib/orders/server";

/**
 * Handle a verified `payment_intent.succeeded` event. Order creation happens
 * ONLY here, and only after Stripe verified the webhook signature.
 *
 * Flow:
 *   1. Read the staged pending_orders row (keyed on the PaymentIntent id).
 *   2. Short-circuit if there is no staged row or it is already fulfilled.
 *   3. Fulfill via the idempotent fulfill_order RPC. A genuine oversell refunds
 *      the buyer, marks the row needs_refund, and RETURNS (never loops).
 *   4. Record the Stripe Tax transaction when a calculation id exists (CHK-02).
 *   5. Rely on the PaymentIntent's receipt_email (set in 06-02) for the receipt.
 *
 * @param {import('stripe').Stripe.PaymentIntent} pi
 */
export async function onPaymentIntentSucceeded(pi) {
  const admin = createAdminClient();

  // 1. Read the staged row.
  const { data: pending } = await admin
    .from("pending_orders")
    .select("*")
    .eq("stripe_pi_id", pi.id)
    .single();

  if (!pending) {
    // Not created through our create-intent path (or metadata-only). Nothing to
    // fulfill — return (do NOT throw, which would trigger a Stripe retry storm).
    console.warn(`[webhook] no pending_orders row for ${pi.id}; nothing to fulfill`);
    return;
  }

  if (pending.status === "fulfilled") {
    // Already done — idempotent short-circuit on event replay.
    return;
  }

  // 2. Fulfill.
  try {
    await createOrderFromIntent(pending);
  } catch (err) {
    if (err?.code === "insufficient_stock") {
      // Genuine oversell (Pitfall 4): refund and stop. A 500 here would make
      // Stripe retry a permanently-failing event forever, so we return 200-equiv.
      try {
        await getStripe().refunds.create({ payment_intent: pi.id });
      } catch (refundErr) {
        console.error(`[webhook] refund failed for ${pi.id}:`, refundErr);
      }
      await admin
        .from("pending_orders")
        .update({ status: "needs_refund" })
        .eq("stripe_pi_id", pi.id);
      console.error(
        `[webhook] oversell on ${pi.id} — refunded buyer, marked needs_refund`
      );
      // 06-05 shows the confirmation page an apologetic "refunded" state.
      return;
    }
    // Transient/other failure: rethrow so the route returns 500 and Stripe
    // retries. fulfill_order is idempotent on stripe_pi_id, so retry is safe.
    throw err;
  }

  // 3. (CHK-02) Record the Stripe Tax transaction so collected tax is reported.
  // The calc id is null when Stripe Tax is off, so guard on truthiness first.
  if (pending.tax_calculation_id) {
    try {
      await getStripe().tax.transactions.createFromCalculation({
        calculation: pending.tax_calculation_id,
        reference: pending.order_number,
      });
    } catch (taxErr) {
      // Degrade silently if Tax reporting fails — the order already succeeded.
      console.error(`[webhook] tax transaction failed for ${pi.id}:`, taxErr);
    }
  }

  // 4. (CHK-06) Receipt: the PaymentIntent carries receipt_email (set in 06-02),
  // so Stripe emails its own receipt automatically — the zero-effort v1 baseline.
  // Optional follow-up: a branded HRR receipt via Resend would hook in here
  // (RESEARCH Open Question 2) — intentionally NOT built in this phase.
}
