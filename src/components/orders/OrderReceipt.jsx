import React from "react";
import { formatPrice } from "@/lib/format";

/**
 * OrderReceipt — the neutral, reusable receipt BODY (CONTEXT: single visual
 * source of truth). Shared by BOTH the confirmation island and the Plan 03
 * order-detail page.
 *
 * Renders ONLY the items + totals + shipping address — NO "Thank you for your
 * order!" headline and NO guest-account note (those belong to the confirmation
 * island's own chrome). Each caller wraps this with its own header so the same
 * body serves a success screen and a neutral historical view.
 *
 * Presentational: pure props render, no "use client" needed. Money is display-
 * only, straight from the order row (CART-04 discipline extended to the receipt).
 *
 * @param {{ order: object }} props
 *   order = { order_number, status, subtotal, shipping, tax, total,
 *             ship_to_snapshot, order_items } (the read.js / by-pi shape)
 */
const OrderReceipt = ({ order }) => {
  const addr = order?.ship_to_snapshot ?? {};
  const items = order?.order_items ?? [];

  return (
    <>
      {/* Purchased items */}
      <div className="border border-gray-100 rounded-16 p-32 mb-32">
        <h6 className="mb-24 text-gray-900">Order summary</h6>

        <div className="mb-24 pb-16 border-bottom border-gray-100 flex-between gap-8">
          <span className="text-gray-500 fw-medium text-sm">Product</span>
          <span className="text-gray-500 fw-medium text-sm">Total</span>
        </div>

        {items.length === 0 ? (
          <p className="text-gray-500 mb-24">No items on this order.</p>
        ) : (
          items.map((line, idx) => (
            <div
              key={`${line.sku_snapshot ?? line.name_snapshot ?? "item"}-${idx}`}
              className="flex-between gap-24 mb-16"
            >
              <div className="flex-align gap-8">
                <span className="text-gray-900 fw-normal text-md">
                  {line.name_snapshot ?? "Item"}
                </span>
                <span className="text-gray-500">
                  <i className="ph-bold ph-x" />
                </span>
                <span className="text-gray-900 fw-semibold text-md">
                  {line.quantity}
                </span>
                <span className="text-gray-500 text-sm">
                  @ {formatPrice(line.unit_price)}
                </span>
              </div>
              <span className="text-gray-900 fw-bold text-md">
                {formatPrice(Number(line.unit_price) * Number(line.quantity))}
              </span>
            </div>
          ))
        )}

        <div className="border-top border-gray-100 pt-24 mt-24">
          <div className="mb-16 flex-between gap-8">
            <span className="text-gray-900 text-md fw-semibold">Subtotal</span>
            <span className="text-gray-900 text-md fw-bold">
              {formatPrice(order?.subtotal)}
            </span>
          </div>
          <div className="mb-16 flex-between gap-8">
            <span className="text-gray-900 text-md fw-semibold">Shipping</span>
            <span className="text-gray-900 text-md fw-bold">
              {formatPrice(order?.shipping)}
            </span>
          </div>
          <div className="mb-16 flex-between gap-8">
            <span className="text-gray-900 text-md fw-semibold">Tax</span>
            <span className="text-gray-900 text-md fw-bold">
              {formatPrice(order?.tax)}
            </span>
          </div>
          <div className="mb-0 flex-between gap-8">
            <span className="text-gray-900 text-xl fw-semibold">Total paid</span>
            <span className="text-gray-900 text-xl fw-bold">
              {formatPrice(order?.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      <div className="border border-gray-100 rounded-16 p-32 mb-40">
        <h6 className="mb-16 text-gray-900">Shipping to</h6>
        <p className="text-gray-700 mb-0">
          {addr.name ? (
            <>
              <span className="fw-semibold text-gray-900">{addr.name}</span>
              <br />
            </>
          ) : null}
          {addr.street1}
          {addr.street2 ? `, ${addr.street2}` : ""}
          <br />
          {addr.city}
          {addr.state ? `, ${addr.state}` : ""} {addr.zip}
          <br />
          {addr.country}
        </p>
      </div>
    </>
  );
};

export default OrderReceipt;
