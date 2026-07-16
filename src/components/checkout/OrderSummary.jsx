"use client";

/**
 * OrderSummary — the persistent checkout summary panel (CHK-01/CHK-02 display).
 *
 * A PURELY PRESENTATIONAL breakdown of the current order: line items, subtotal,
 * shipping, a DISTINCT tax line, and the total. It never fetches and never
 * computes a price/tax — every number is passed down (dollars) from Checkout.jsx,
 * which sources the authoritative tax + total from the server payment-intent
 * breakdown (CART-04 discipline extended to payment).
 *
 * Tax (CHK-02) is its own line, never folded into another. While the payment
 * intent hasn't resolved tax yet (`taxAmount == null`) it shows "Calculated at
 * payment"; once resolved it shows the amount (which may be $0.00 when Stripe Tax
 * is off — the tax seam degrades to zero, mirroring the EasyPost key-gate).
 *
 * Canada (CONTEXT): when country === 'CA' we surface the two required notices —
 * all prices in USD, and import duties/taxes are the customer's responsibility on
 * delivery (not calculated here).
 *
 * Bootstrap 5 markup matching the original template summary column. All copy in
 * English (CLAUDE.md).
 */

import React from "react";

function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

const OrderSummary = ({
  lines,
  subtotal,
  shippingAmount,
  taxAmount,
  total,
  country,
  isEstimatedShipping,
}) => {
  const items = lines ?? [];

  return (
    <div className="checkout-summary">
      <div className="bg-color-three rounded-8 p-24 text-center">
        <span className="text-gray-900 text-xl fw-semibold">Your Order</span>
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

        {items.length === 0 ? (
          <p className="text-gray-500">Your cart is empty.</p>
        ) : (
          items.map((line) => (
            <div
              key={line.variant_id}
              className="flex-between gap-24 mb-32"
            >
              <div
                className="flex-align gap-12 flex-grow-1"
                style={{ minWidth: 0 }}
              >
                <span className="text-gray-900 fw-normal text-md font-heading-two text-line-2 flex-grow-1">
                  {line.product?.name ?? "Item"}
                </span>
                <span className="text-gray-900 fw-normal text-md font-heading-two">
                  <i className="ph-bold ph-x" />
                </span>
                <span className="text-gray-900 fw-semibold text-md font-heading-two">
                  {line.quantity}
                </span>
              </div>
              <span className="text-gray-900 fw-bold text-md font-heading-two text-nowrap">
                {formatPrice(line.line_subtotal)}
              </span>
            </div>
          ))
        )}

        <div className="border-top border-gray-100 pt-30 mt-30">
          {/* Subtotal — always shown. */}
          <div className="mb-24 flex-between gap-8">
            <span className="text-gray-900 font-heading-two text-md fw-semibold">
              Subtotal
            </span>
            <span className="text-gray-900 font-heading-two text-md fw-bold">
              {formatPrice(subtotal)}
            </span>
          </div>

          {/* Shipping — amount once a rate is selected, else a prompt. */}
          <div className="mb-24 flex-between gap-8">
            <span className="text-gray-900 font-heading-two text-md fw-semibold">
              Shipping
              {shippingAmount != null && isEstimatedShipping && (
                <span className="text-gray-500 fw-normal text-sm ms-4">
                  (estimated)
                </span>
              )}
            </span>
            <span className="text-gray-900 font-heading-two text-md fw-bold">
              {shippingAmount != null
                ? formatPrice(shippingAmount)
                : "Select an address"}
            </span>
          </div>

          {/* Tax — a DISTINCT line (CHK-02); "Calculated at payment" until the
              server payment-intent resolves it. Never folded into another row. */}
          <div className="mb-24 flex-between gap-8">
            <span className="text-gray-900 font-heading-two text-md fw-semibold">
              Tax
            </span>
            <span className="text-gray-900 font-heading-two text-md fw-bold">
              {taxAmount != null
                ? formatPrice(taxAmount)
                : "Calculated at payment"}
            </span>
          </div>

          {/* Total — subtotal + shipping + (tax ?? 0); matches the Pay button. */}
          <div className="mb-0 flex-between gap-8">
            <span className="text-gray-900 font-heading-two text-xl fw-semibold">
              Total
            </span>
            <span className="text-gray-900 font-heading-two text-md fw-bold">
              {formatPrice(total)}
            </span>
          </div>
        </div>

        {/* Canada notices (CONTEXT): USD pricing + import-duties responsibility. */}
        {country === "CA" && (
          <div className="border-top border-gray-100 pt-24 mt-24">
            <p className="text-gray-700 text-sm mb-8">All prices in USD.</p>
            <p className="text-gray-700 text-sm mb-0">
              Import duties/taxes are the customer&apos;s responsibility on
              delivery and are not calculated here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderSummary;
