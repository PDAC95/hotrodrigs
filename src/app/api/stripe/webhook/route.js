import { getStripe } from "@/lib/stripe/server";
import { onPaymentIntentSucceeded } from "@/lib/stripe/webhook-handlers";

// MUST be the Node runtime: the Edge runtime re-encodes the request body, which
// breaks the Stripe signature check (Pitfall 1). Signature verification needs the
// exact raw bytes Stripe signed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook
 *
 * The ONLY place an order is created — and only after Stripe's signature is
 * verified. Reads the RAW body (never req.json() first — Pitfall 2), verifies the
 * signature against STRIPE_WEBHOOK_SECRET, then dispatches:
 *   - payment_intent.succeeded -> onPaymentIntentSucceeded (idempotent fulfillment)
 *   - payment_intent.payment_failed -> log only (order is created solely on success)
 *
 * Returns 400 on a bad/absent signature (never processed), 500 on a handler error
 * so Stripe retries (the fulfill_order RPC is idempotent, making retry safe).
 */
export async function POST(req) {
  const stripe = getStripe();

  const body = await req.text(); // RAW — never req.json() first (Pitfall 2)
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(
      `Webhook signature verification failed: ${err.message}`,
      { status: 400 }
    );
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      await onPaymentIntentSucceeded(event.data.object);
    }
    // payment_intent.payment_failed: log only; no order is created on failure.
  } catch (err) {
    console.error("[webhook] handler error:", err);
    // 500 -> Stripe retries; idempotency (on conflict stripe_pi_id) makes it safe.
    return new Response("handler error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
