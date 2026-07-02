"use client";

/**
 * Confirmation — the post-payment receipt island (CHK-06, RESEARCH Pattern 8).
 *
 * After a successful payment the customer is redirected here with the
 * PaymentIntent id in the URL (both the on-site onSuccess path from 06-04 and the
 * Stripe redirect return_url append `payment_intent` + `payment_intent_client_secret`).
 * The order is created ASYNCHRONOUSLY by the signature-verified webhook, so at
 * redirect time it may not exist yet. This island:
 *
 *   1. Reads `payment_intent` (id) from `window.location.search` on mount — NOT
 *      `useSearchParams`, so the route stays static (mirrors the Phase 3/4 decision).
 *   2. Polls `GET /api/orders/by-pi/:piId` until the webhook has created the order,
 *      showing a reassuring "Confirming your payment…" state meanwhile — NEVER a
 *      false error just because the webhook hasn't landed yet (CONTEXT race rule).
 *   3. Renders the full receipt once the order returns (order number, items,
 *      shipping address, shipping/subtotal/tax/total) with "View order" +
 *      "Continue shopping" next actions.
 *   4. Handles the `needs_refund` terminal state (06-03 oversell fallback) with an
 *      apologetic refunded message instead of a receipt (Pitfall 4).
 *
 * Money here is display-only — every number comes from the server order row; this
 * island never computes a price (CART-04 discipline extended to the receipt).
 *
 * Bootstrap 5 markup matching the template. All copy English (CLAUDE.md).
 */

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OrderReceipt from "@/components/orders/OrderReceipt";
import { useCart } from "@/components/cart/CartProvider";
import { activateGuestAccount } from "@/lib/orders/activate-actions";

const POLL_TRIES = 12;
const POLL_DELAY_MS = 1500;

/**
 * Poll the order route until the webhook has created the order.
 * - 200 with an order_number -> the fulfilled order (resolve).
 * - 200 with status:'needs_refund' -> terminal refunded state (resolve).
 * - 404 -> not created yet, keep polling.
 * Returns null if all tries exhaust (soft "still confirming" state, never an error).
 */
async function waitForOrder(piId, { tries = POLL_TRIES, delayMs = POLL_DELAY_MS } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`/api/orders/by-pi/${piId}`);
      if (r.ok) {
        const data = await r.json();
        return data;
      }
    } catch {
      // Network hiccup — treat like "not yet", keep polling (never a false error).
    }
    if (i < tries - 1) {
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  return null;
}

const Confirmation = () => {
  // "loading" | "receipt" | "refunded" | "waiting" | "no-order"
  const [phase, setPhase] = useState("loading");
  const [order, setOrder] = useState(null);
  const [piId, setPiId] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [email, setEmail] = useState(null);
  const [attempt, setAttempt] = useState(0); // bump to retry after "waiting"

  useEffect(() => {
    // Read the PaymentIntent id + client_secret from the URL on mount (window, not
    // useSearchParams — keeps the route static). Both onSuccess + Stripe redirect
    // append these; the client_secret proves purchase for guest activation.
    const params = new URLSearchParams(window.location.search);
    const pi = params.get("payment_intent");

    if (!pi) {
      setPhase("no-order");
      return;
    }
    setPiId(pi);
    setClientSecret(params.get("payment_intent_client_secret"));

    let cancelled = false;
    setPhase("loading");

    waitForOrder(pi).then((result) => {
      if (cancelled) return;

      if (!result) {
        // All tries exhausted and still no order — soft state, NOT an error.
        setPhase("waiting");
        return;
      }

      if (result.status === "needs_refund") {
        setOrder(result);
        setPhase("refunded");
        return;
      }

      // A fulfilled order row.
      setOrder(result);
      // The by-pi route now returns the real buyer email (from pending_orders) so
      // the guest-account note personalizes when present, generic copy when absent.
      setEmail(result.email ?? null);
      setPhase("receipt");
    });

    return () => {
      cancelled = true;
    };
    // `attempt` re-runs the poll when the user hits "Refresh" in the waiting state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Guest account activation (ACCT-03). Only a signed-out viewer sees the CTA; the
  // server action re-verifies the purchase and only sets a password on an
  // unactivated guest account. On success the buyer is signed in → their order.
  const router = useRouter();
  const { mounted, isLoggedIn } = useCart();
  const [password, setPassword] = useState("");
  const [activateError, setActivateError] = useState(null);
  const [isActivating, startActivate] = useTransition();

  const canActivate = mounted && !isLoggedIn;

  function handleActivate(e) {
    e.preventDefault();
    setActivateError(null);
    if (password.length < 8) {
      setActivateError("Password must be at least 8 characters.");
      return;
    }
    startActivate(async () => {
      const res = await activateGuestAccount({ piId, clientSecret, password });
      if (res?.ok) {
        router.push(`/account/orders/${encodeURIComponent(res.orderNumber)}`);
        return;
      }
      const map = {
        registered: "This email already has an account — please log in instead.",
        already_activated: "This account is already set up — please log in.",
        weak_password: "Password must be at least 8 characters.",
        invalid_request:
          "We couldn't verify this purchase. Use the link in your receipt email.",
      };
      setActivateError(map[res?.error] || "Something went wrong — please try again.");
    });
  }

  // ---- Neutral "no order details" state (missing payment_intent param) ----
  if (phase === "no-order") {
    return (
      <section className="py-80">
        <div className="container container-lg">
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="border border-gray-100 rounded-16 p-40 text-center">
                <h4 className="mb-16 text-gray-900">We couldn&apos;t find your order details</h4>
                <p className="text-gray-600 mb-32">
                  We couldn&apos;t match this page to a recent payment. If you just
                  paid, check your email for a receipt, or continue shopping.
                </p>
                <Link href="/" className="btn btn-main py-18 px-40 rounded-8">
                  Continue shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---- Refunded / oversell terminal state (Pitfall 4) ----
  if (phase === "refunded") {
    return (
      <section className="py-80">
        <div className="container container-lg">
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="border border-gray-100 rounded-16 p-40 text-center">
                <span className="text-warning-600 text-4xl mb-16 d-inline-block">
                  <i className="ph-bold ph-warning-circle" />
                </span>
                <h4 className="mb-16 text-gray-900">
                  We couldn&apos;t complete your order
                </h4>
                <p className="text-gray-600 mb-8">
                  One or more items sold out before we could confirm your order, so
                  your payment has been refunded in full.
                </p>
                {order?.order_number && (
                  <p className="text-gray-500 mb-32">
                    Reference: {order.order_number}
                  </p>
                )}
                <p className="text-gray-600 mb-32">
                  Refunds typically appear on your statement within a few business
                  days. We&apos;re sorry for the inconvenience.
                </p>
                <Link href="/" className="btn btn-main py-18 px-40 rounded-8">
                  Continue shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---- Procesando race state (loading) + soft "still confirming" (waiting) ----
  if (phase === "loading" || phase === "waiting") {
    return (
      <section className="py-80">
        <div className="container container-lg">
          <div className="row justify-content-center">
            <div className="col-lg-7">
              <div className="border border-gray-100 rounded-16 p-40 text-center">
                <div className="d-flex justify-content-center mb-24">
                  <div
                    className="spinner-border text-main-600"
                    role="status"
                    style={{ width: "3rem", height: "3rem" }}
                  >
                    <span className="visually-hidden">Loading…</span>
                  </div>
                </div>
                <h4 className="mb-16 text-gray-900">Confirming your payment…</h4>
                {phase === "loading" ? (
                  <p className="text-gray-600 mb-0">
                    This only takes a moment. Please don&apos;t close this page.
                  </p>
                ) : (
                  <>
                    <p className="text-gray-600 mb-32">
                      Your payment went through and we&apos;re still finalizing your
                      order. This can take a moment longer than usual — refresh in a
                      few seconds.
                    </p>
                    <button
                      type="button"
                      className="btn btn-main py-18 px-40 rounded-8"
                      onClick={() => setAttempt((n) => n + 1)}
                    >
                      Refresh
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---- Full receipt (phase === "receipt") ----
  return (
    <section className="py-80">
      <div className="container container-lg">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            {/* Success headline + order number */}
            <div className="text-center mb-40">
              <span className="text-success-600 text-4xl mb-16 d-inline-block">
                <i className="ph-fill ph-check-circle" />
              </span>
              <h3 className="mb-8 text-gray-900">Thank you for your order!</h3>
              <p className="text-gray-600 mb-8">
                Your payment was successful and your order is confirmed.
              </p>
              {order?.order_number && (
                <p className="text-gray-900 fw-semibold text-lg mb-0">
                  Order {order.order_number}
                </p>
              )}
            </div>

            {/* Guest account activation (ACCT-03). Signed-out buyers set a password
                here to activate the account we created for them and track the order.
                Signed-in buyers already have it in their account — no CTA. */}
            {canActivate && email && (
              <div className="bg-color-three rounded-8 p-24 mb-32">
                <h6 className="text-lg mb-8 text-gray-900">
                  Create your account to track this order
                </h6>
                <p className="text-gray-700 mb-16">
                  We&apos;ve set up an account for <strong>{email}</strong>. Choose a
                  password to activate it and view your order any time.
                </p>
                <form onSubmit={handleActivate} className="d-flex flex-column gap-12">
                  <label htmlFor="activate-password" className="visually-hidden">
                    Password
                  </label>
                  <input
                    id="activate-password"
                    type="password"
                    className="common-input rounded-8"
                    placeholder="Choose a password (min. 8 characters)"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isActivating}
                  />
                  {activateError && (
                    <p className="text-danger-600 text-sm mb-0">{activateError}</p>
                  )}
                  <button
                    type="submit"
                    className="btn btn-main py-16 px-32 rounded-8"
                    disabled={isActivating}
                  >
                    {isActivating ? "Activating…" : "Activate & view order"}
                  </button>
                </form>
                <p className="text-sm text-gray-500 mb-0 mt-12">
                  Already have an account?{" "}
                  <Link href="/login" className="text-main-600">
                    Log in
                  </Link>
                </p>
              </div>
            )}

            {/* Receipt body — shared with the Plan 03 order-detail page
                (CONTEXT: single visual source of truth). */}
            <OrderReceipt order={order} />

            {/* Next actions — "View order" deep-links to the Plan 03 order-detail
                page when we have an order number (always true in the receipt phase). */}
            <div className="d-flex flex-wrap justify-content-center gap-16">
              {order?.order_number && (
                <Link
                  href={`/account/orders/${encodeURIComponent(order.order_number)}`}
                  className="btn btn-main py-18 px-40 rounded-8"
                >
                  View order
                </Link>
              )}
              <Link
                href="/"
                className="btn btn-outline-gray py-18 px-40 rounded-8"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Confirmation;
