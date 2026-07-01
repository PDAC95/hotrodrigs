"use client";

/**
 * Checkout — the single-page on-site payment experience (Phase 6, CHK-01/02/03).
 *
 * Extends Phase 5's address + shipping flow with the final payment section:
 *   1. AddressForm   — US/CA address (EasyPost shape), applies server suggestions.
 *   2. ShippingRates — debounced live rates from /api/shipping/quote.
 *   3. Email + notes — guest checkout identity + optional PO/notes.
 *   4. PaymentSection — the embedded orange Stripe Payment Element (on-site).
 *   + OrderSummary   — a persistent panel with a DISTINCT tax line + total.
 *
 * When address + selected rate + a valid email + a non-empty cart are all ready,
 * we POST to /api/stripe/create-payment-intent (which recomputes the amount
 * server-side — the client NEVER sends a price/amount/tax, CART-04 extended to
 * payment) and store { clientSecret, orderNumber, breakdown }. The clientSecret is
 * REFETCHED whenever any of those inputs change so a stale secret can never charge
 * a stale amount (same Pitfall-7 discipline as ShippingRates).
 *
 * The server breakdown is authoritative: once it exists, the summary + Pay button
 * show the server tax + total; before it exists, tax reads "Calculated at payment".
 *
 * onSuccess (card, no redirect) routes to
 *   /checkout/confirmation?payment_intent=<id>&payment_intent_client_secret=<cs>
 * — the same params 06-05's confirmation page reads. Redirect-based methods use
 * the return_url set inside PaymentForm.
 *
 * All copy in English (CLAUDE.md). Bootstrap markup matching the template.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AddressForm from "@/components/shipping/AddressForm";
import ShippingRates from "@/components/shipping/ShippingRates";
import OrderSummary from "@/components/checkout/OrderSummary";
import PaymentSection from "@/components/checkout/PaymentSection";
import { useCart } from "@/components/cart/CartProvider";
import { getGuestCart } from "@/lib/cart/guest-store";

function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

// Minimal client-side email sanity check (the server re-validates via zod).
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "");
}

// Stable key for the (address + rate + email + cart) tuple. Any change refetches
// a fresh clientSecret so a stale amount can never be charged (Pitfall 7).
function intentKey(address, rateId, email, guestCart) {
  return JSON.stringify({
    a: address,
    r: rateId ?? null,
    e: email ?? "",
    c: guestCart ?? null,
  });
}

const Checkout = () => {
  const { lines, isLoggedIn, mounted } = useCart();
  const router = useRouter();

  const [address, setAddress] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Server payment-intent state.
  const [clientSecret, setClientSecret] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState(null);
  // Insufficient-stock items lifted from a 409 (don't render payment).
  const [stockIssue, setStockIssue] = useState(null);

  // Guests send their localStorage cart; logged-in callers omit it (server reads
  // the RLS cart). Recomputed from the same lines the summary renders.
  const guestCart = useMemo(() => {
    if (!mounted || isLoggedIn) return null;
    return getGuestCart();
    // lines is the reactive trigger for a cart change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isLoggedIn, lines]);

  const subtotal = useMemo(
    () =>
      (lines ?? []).reduce(
        (sum, l) => sum + (Number(l.line_subtotal) || 0),
        0
      ),
    [lines]
  );

  const shippingAmount =
    selectedRate?.amount != null ? Number(selectedRate.amount) : null;
  const isEstimatedShipping = selectedRate?.estimated === true;

  const cartCount = (lines ?? []).length;
  const emailOk = isValidEmail(email);

  // The tuple that drives the create-intent fetch. Guarded so it fires once per
  // real change and refetches on any input change.
  const readyToIntent =
    !!address &&
    !!selectedRate?.id &&
    emailOk &&
    cartCount > 0;

  const key = readyToIntent
    ? intentKey(address, selectedRate.id, email, guestCart)
    : "";

  const abortRef = useRef(null);

  useEffect(() => {
    // Any change invalidates the previous intent — clear it so a stale secret
    // never lingers (Pitfall 7). Refetch only when the full tuple is ready.
    if (abortRef.current) abortRef.current.abort();
    setClientSecret(null);
    setOrderNumber(null);
    setBreakdown(null);
    setIntentError(null);
    setStockIssue(null);

    if (!key) {
      setIntentLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;

    setIntentLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            address,
            selected_rate_id: selectedRate.id,
            guest_cart: guestCart ?? undefined,
            notes: notes || undefined,
          }),
          signal: controller.signal,
        });
        if (cancelled) return;

        // 409 insufficient_stock -> list the items, don't render payment.
        if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          setStockIssue(data.items ?? []);
          setIntentLoading(false);
          return;
        }

        if (!res.ok) {
          setIntentError("intent_failed");
          setIntentLoading(false);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        // Unverified address -> lift the suggestion; don't render payment.
        if (data.verified === false) {
          setSuggestion(data.suggestion ?? null);
          setIntentLoading(false);
          return;
        }

        setSuggestion(null);
        setClientSecret(data.clientSecret ?? null);
        setOrderNumber(data.orderNumber ?? null);
        setBreakdown(data.breakdown ?? null);
        setIntentLoading(false);
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setIntentError("intent_failed");
        setIntentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (abortRef.current) abortRef.current.abort();
    };
    // notes intentionally excluded from `key` (it doesn't change the amount); the
    // latest value is read at fetch time. address/rate/email/cart drive refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Money display is driven by the server breakdown once it exists; before it
  // exists, show subtotal + shipping only and tax as "Calculated at payment".
  const taxAmount =
    breakdown != null ? breakdown.taxCents / 100 : null;
  const total =
    breakdown != null
      ? breakdown.totalCents / 100
      : subtotal + (shippingAmount ?? 0);

  const handleSuccess = (paymentIntent) => {
    if (!paymentIntent) return;
    router.push(
      `/checkout/confirmation?payment_intent=${paymentIntent.id}` +
        `&payment_intent_client_secret=${clientSecret}`
    );
  };

  return (
    <section className="checkout py-80">
      <div className="container container-lg">
        <div className="row">
          <div className="col-xl-9 col-lg-8">
            <div className="pe-xl-5">
              {/* Address step */}
              <div className="border border-gray-100 rounded-8 px-30 py-30 mb-30">
                <AddressForm
                  onAddressChange={setAddress}
                  suggestion={suggestion}
                />
              </div>

              {/* Contact step — email (guest identity) + optional notes/PO. */}
              <div className="border border-gray-100 rounded-8 px-30 py-30 mb-30">
                <h6 className="text-lg mb-24">Contact</h6>
                <div className="row gy-3">
                  <div className="col-12">
                    <input
                      type="email"
                      className="common-input border-gray-100"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {email && !emailOk && (
                      <p className="text-danger-600 mt-8 mb-0">
                        Enter a valid email address.
                      </p>
                    )}
                  </div>
                  <div className="col-12">
                    <textarea
                      className="common-input border-gray-100"
                      rows={3}
                      placeholder="Order notes / PO number (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Shipping step */}
              <div className="border border-gray-100 rounded-8 px-30 py-30 mb-30">
                <ShippingRates
                  address={address}
                  guestCart={guestCart}
                  onSelect={setSelectedRate}
                  onSuggestion={setSuggestion}
                />
              </div>

              {/* Payment step — embedded on-site Stripe Payment Element. */}
              <div className="border border-gray-100 rounded-8 px-30 py-30">
                <h6 className="text-lg mb-24">Payment</h6>

                {stockIssue ? (
                  <div className="border border-warning-600 bg-warning-50 rounded-8 px-20 py-16">
                    <p className="text-gray-900 fw-medium mb-8">
                      Some items are no longer available:
                    </p>
                    <ul className="text-gray-700 mb-8 ps-20">
                      {stockIssue.map((it) => (
                        <li key={it.variant_id}>{it.name}</li>
                      ))}
                    </ul>
                    <p className="text-gray-700 mb-0">
                      Please adjust your cart and try again.
                    </p>
                  </div>
                ) : intentError ? (
                  <div className="border border-warning-600 bg-warning-50 rounded-8 px-20 py-16">
                    <p className="text-gray-900 mb-0">
                      We couldn&apos;t start payment. Please review your details
                      and try again.
                    </p>
                  </div>
                ) : intentLoading ? (
                  <div className="flex-align gap-12 text-gray-700">
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    />
                    <span>Preparing payment…</span>
                  </div>
                ) : clientSecret ? (
                  <PaymentSection
                    clientSecret={clientSecret}
                    amountLabel={formatPrice(total)}
                    onSuccess={handleSuccess}
                  />
                ) : (
                  <p className="text-gray-500 mb-0">
                    Enter your address, email, and choose a shipping method to
                    continue to payment.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-lg-4">
            <div className="checkout-sidebar">
              {!mounted ? (
                <p className="text-gray-500">Loading your cart…</p>
              ) : (
                <OrderSummary
                  lines={lines}
                  subtotal={subtotal}
                  shippingAmount={shippingAmount}
                  taxAmount={taxAmount}
                  total={total}
                  country={address?.country}
                  isEstimatedShipping={isEstimatedShipping}
                />
              )}

              {orderNumber && (
                <p className="text-gray-500 text-sm mt-16 mb-0">
                  Order reference: {orderNumber}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Checkout;
