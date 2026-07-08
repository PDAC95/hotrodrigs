import "server-only"; // only reachable from the verified webhook route

import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrderFromIntent } from "@/lib/orders/server";
import { sendOnce } from "@/lib/email/send";
import {
  orderConfirmationEmail,
  guestActivationEmail,
} from "@/lib/email/templates";

/**
 * Handle a verified `payment_intent.succeeded` event. Order creation happens
 * ONLY here, and only after Stripe verified the webhook signature.
 *
 * Flow:
 *   1. Read the staged pending_orders row (keyed on the PaymentIntent id).
 *   2. Short-circuit if there is no staged row or it is already fulfilled.
 *   3. Fulfill via the idempotent fulfill_order RPC. Tracked shortages clamp at
 *      0 and flag orders.stock_issue inside the RPC (Phase 13) — the order
 *      always fulfills; NO automatic refunds (locked decision).
 *   4. Record the Stripe Tax transaction when a calculation id exists (CHK-02).
 *   5. Send the branded post-order emails (EML-01 order confirmation for every
 *      buyer; EML-02 activation link for a genuinely new guest account) —
 *      best-effort, claim-guarded in sent_emails, NEVER a webhook failure.
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
  let isNewGuest = false;
  try {
    ({ isNewGuest } = await createOrderFromIntent(pending));
  } catch (err) {
    if (err?.code === "insufficient_stock") {
      // Phase 13: fulfill_order no longer raises for oversell (tracked shortages
      // clamp at 0 and flag orders.stock_issue for manual resolution — locked
      // decision: NO automatic refunds). This branch is defensive dead code for
      // an unexpected legacy raise; log loudly and stop (returning 200-equiv so
      // Stripe doesn't retry a permanently-failing event).
      console.error(
        `[webhook] UNEXPECTED insufficient_stock on ${pi.id} — NOT refunding (Phase 13 policy); investigate manually`
      );
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

  // 4. (EML-01/EML-02) Post-order emails — best-effort, NEVER throws out of the
  // webhook (EML-04). sent_emails UNIQUE claim arbitrates concurrent deliveries.
  try {
    await sendPostOrderEmails(pending, isNewGuest);
  } catch (emailErr) {
    console.error(
      `[email] post-order emails failed for ${pi.id} (non-fatal):`,
      emailErr
    );
  }
}

/**
 * Send the purchase-moment emails for a just-fulfilled order:
 *
 *   - order_confirmation (EML-01): every buyer, rendered off the pending row
 *     (server-authoritative money, real tax post-Phase 11).
 *   - guest_activation (EML-02): ONLY when this fulfillment created a brand-new
 *     guest account. The link is a Supabase recovery token_hash routed through
 *     OUR /auth/confirm on the app origin — never the ready-made URL Supabase
 *     also returns (it points at the Supabase origin) and never a PI secret.
 *
 * sendOnce never throws (claim-then-send against sent_emails); the only
 * throw-capable call here (generateLink) is guarded. The caller's try/catch is
 * the second wall (EML-04: no email path can 500 the webhook).
 *
 * @param {object} pending - the fulfilled public.pending_orders row
 * @param {boolean} isNewGuest - true when fulfillment created a new guest account
 */
async function sendPostOrderEmails(pending, isNewGuest) {
  if (!pending?.email) {
    console.warn(
      `[email] no buyer email on ${pending?.order_number} — skipping emails`
    );
    return;
  }

  // EML-01 — order confirmation for EVERY buyer.
  const confirmation = orderConfirmationEmail(pending);
  await sendOnce({
    orderNumber: pending.order_number,
    emailType: "order_confirmation",
    to: pending.email,
    ...confirmation,
  });

  // EML-02 — activation link for genuinely NEW guest accounts only.
  if (!isNewGuest) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error("[email] NEXT_PUBLIC_SITE_URL unset — skipping activation email");
    return;
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "recovery",
    email: pending.email,
  });
  // The token lives at data.properties.hashed_token (supabase-js v2). A failed
  // generateLink must never block/undo the confirmation email already sent.
  if (error || !data?.properties?.hashed_token) {
    console.error(
      `[email] generateLink failed for ${pending.order_number}:`,
      error
    );
    return;
  }

  const activationUrl = `${siteUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/account/set-password`;

  const activation = guestActivationEmail({
    email: pending.email,
    orderNumber: pending.order_number,
    activationUrl,
  });
  await sendOnce({
    orderNumber: pending.order_number,
    emailType: "guest_activation",
    to: pending.email,
    ...activation,
  });
}
