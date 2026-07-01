"use client";

/**
 * PaymentSection — the embedded Stripe Elements provider (CHK-03).
 *
 * Wraps PaymentForm in a Stripe <Elements> provider bound to the server-issued
 * clientSecret and themed to the site's orange (#FA6400 — the ColorInit orange).
 * Only the PUBLISHABLE key + @stripe/stripe-js reach the client; the secret key
 * never leaves the server (Pitfall 7 — the leak gate stays green).
 *
 * Graceful degradation: if NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is absent,
 * loadStripe yields a promise that never resolves to a Stripe instance, which
 * would leave the Payment Element blank forever. Instead we detect the missing
 * key and render a small "temporarily unavailable" notice (mirrors the tax/
 * EasyPost key-gate discipline — never crash checkout).
 *
 * All copy in English (CLAUDE.md).
 */

import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

import PaymentForm from "./PaymentForm";

// The publishable key is a client secret-free token, safe to expose (NEXT_PUBLIC).
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Load once at module scope (Stripe's recommendation — avoids re-instantiating on
// every render). Null when the key is missing so we can degrade gracefully.
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

// Orange-themed appearance to match the site (#FA6400 = ColorInit orange).
const appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#FA6400",
    borderRadius: "6px",
  },
};

const PaymentSection = ({ clientSecret, amountLabel, onSuccess }) => {
  // No clientSecret yet -> the parent is still preparing the intent.
  if (!clientSecret) return null;

  // Missing publishable key -> don't render a Payment Element that can never load.
  if (!stripePromise) {
    return (
      <div className="border border-warning-600 bg-warning-50 rounded-8 px-20 py-16">
        <p className="text-gray-900 mb-0">
          Payment is temporarily unavailable. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance, loader: "auto" }}
    >
      <PaymentForm amountLabel={amountLabel} onSuccess={onSuccess} />
    </Elements>
  );
};

export default PaymentSection;
