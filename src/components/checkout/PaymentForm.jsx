"use client";

/**
 * PaymentForm — the on-site Stripe Payment Element + confirm flow (CHK-03).
 *
 * Renders the embedded <PaymentElement> and confirms the payment with
 * `redirect: 'if_required'`, which keeps card payments ON-SITE (no redirect):
 * on success Stripe returns the PaymentIntent and we hand it to the parent to
 * navigate to the confirmation page. Redirect-based methods (if any) fall back to
 * the return_url. A payment error renders INLINE under the field so the customer
 * retries without losing checkout state (CONTEXT).
 *
 * The Pay button shows the exact server-computed total ("Pay $XXX.XX", CONTEXT).
 * All copy in English (CLAUDE.md).
 */

import React, { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const PaymentForm = ({ amountLabel, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    // Stripe.js / Elements not ready yet -> ignore the submit.
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/confirmation`,
      },
      redirect: "if_required", // stay on-site for card payments (CHK-03)
    });

    if (confirmError) {
      // Inline error, state preserved — the customer can correct and retry.
      setError(confirmError.message);
      setSubmitting(false);
      return;
    }

    // Success with no redirect (card): hand the PI to the parent to navigate to
    // the confirmation page.
    onSuccess?.(paymentIntent);
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      {error && <p className="text-danger-600 mt-12 mb-0">{error}</p>}

      <button
        type="submit"
        className="btn btn-main mt-24 py-18 w-100 rounded-8"
        disabled={!stripe || submitting}
      >
        {submitting ? "Processing…" : `Pay ${amountLabel}`}
      </button>
    </form>
  );
};

export default PaymentForm;
