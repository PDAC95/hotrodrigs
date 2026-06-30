"use client";

/**
 * Checkout — the wired address + shipping step (Phase 5).
 *
 * Replaces the hardcoded MarketPro form (no state, no Supabase) with a real
 * two-part flow:
 *   1. AddressForm  — saved-address picker / US-CA new-address form; lifts an
 *                     EasyPost-shaped address + applies a server suggestion.
 *   2. ShippingRates — debounced live rates from /api/shipping/quote; cheapest-
 *                      first radio list, estimated + freight notices, spinner
 *                      timeout.
 *
 * The order-summary column renders the REAL cart (server-derived lines from
 * useCart, CART-04 — the client never computes a price) and shows the selected
 * shipping amount once a rate is chosen.
 *
 * Guest vs logged-in: useCart() tells us; guests post `guestCart`
 * ([{variant_id, quantity}]), logged-in callers omit it (the server reads their
 * RLS cart).
 *
 * This phase ENDS at "address validated + shipping selected". Payment / tax /
 * order are Phase 6, so the action button is a disabled "Continue to payment".
 * All copy in English (CLAUDE.md).
 */

import React, { useMemo, useState } from "react";

import AddressForm from "@/components/shipping/AddressForm";
import ShippingRates from "@/components/shipping/ShippingRates";
import { useCart } from "@/components/cart/CartProvider";
import { getGuestCart } from "@/lib/cart/guest-store";

function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

const Checkout = () => {
  const { lines, isLoggedIn, mounted } = useCart();

  const [address, setAddress] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);
  const [suggestion, setSuggestion] = useState(null);

  // Guests send their localStorage cart to the quote endpoint; logged-in callers
  // omit it (the server reads the RLS cart). Recomputed from the same lines the
  // summary renders so a cart change re-quotes (Pitfall 7).
  const guestCart = useMemo(() => {
    if (!mounted || isLoggedIn) return null;
    return getGuestCart();
    // lines is the reactive trigger: any add/remove updates it, re-deriving the
    // guest cart -> ShippingRates re-quotes.
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

  const total = subtotal + (shippingAmount ?? 0);

  const canContinue = !!address && !!selectedRate;

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

              {/* Shipping step */}
              <div className="border border-gray-100 rounded-8 px-30 py-30">
                <ShippingRates
                  address={address}
                  guestCart={guestCart}
                  onSelect={setSelectedRate}
                  onSuggestion={setSuggestion}
                />
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-lg-4">
            <div className="checkout-sidebar">
              <div className="bg-color-three rounded-8 p-24 text-center">
                <span className="text-gray-900 text-xl fw-semibold">
                  Your Order
                </span>
              </div>
              <div className="border border-gray-100 rounded-8 px-24 py-40 mt-24">
                <div className="mb-32 pb-32 border-bottom border-gray-100 flex-between gap-8">
                  <span className="text-gray-900 fw-medium text-xl font-heading-two">
                    Product
                  </span>
                  <span className="text-gray-900 fw-medium text-xl font-heading-two">
                    Subtotal
                  </span>
                </div>

                {!mounted ? (
                  <p className="text-gray-500">Loading your cart…</p>
                ) : (lines ?? []).length === 0 ? (
                  <p className="text-gray-500">Your cart is empty.</p>
                ) : (
                  lines.map((line) => (
                    <div
                      key={line.variant_id}
                      className="flex-between gap-24 mb-32"
                    >
                      <div className="flex-align gap-12">
                        <span className="text-gray-900 fw-normal text-md font-heading-two w-144">
                          {line.product?.name ?? "Item"}
                        </span>
                        <span className="text-gray-900 fw-normal text-md font-heading-two">
                          <i className="ph-bold ph-x" />
                        </span>
                        <span className="text-gray-900 fw-semibold text-md font-heading-two">
                          {line.quantity}
                        </span>
                      </div>
                      <span className="text-gray-900 fw-bold text-md font-heading-two">
                        {formatPrice(line.line_subtotal)}
                      </span>
                    </div>
                  ))
                )}

                <div className="border-top border-gray-100 pt-30 mt-30">
                  <div className="mb-24 flex-between gap-8">
                    <span className="text-gray-900 font-heading-two text-md fw-semibold">
                      Subtotal
                    </span>
                    <span className="text-gray-900 font-heading-two text-md fw-bold">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  <div className="mb-24 flex-between gap-8">
                    <span className="text-gray-900 font-heading-two text-md fw-semibold">
                      Shipping
                    </span>
                    <span className="text-gray-900 font-heading-two text-md fw-bold">
                      {shippingAmount != null
                        ? formatPrice(shippingAmount)
                        : "Select an address"}
                    </span>
                  </div>
                  <div className="mb-0 flex-between gap-8">
                    <span className="text-gray-900 font-heading-two text-xl fw-semibold">
                      Total
                    </span>
                    <span className="text-gray-900 font-heading-two text-md fw-bold">
                      {shippingAmount != null
                        ? formatPrice(total)
                        : formatPrice(subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-32 pt-32 border-top border-gray-100">
                <p className="text-gray-500">
                  Payment is the next step — this build stops at a validated
                  address and a selected shipping option.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-main mt-40 py-18 w-100 rounded-8"
                disabled={!canContinue}
                title="Payment is coming in a later phase"
              >
                Continue to payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Checkout;
