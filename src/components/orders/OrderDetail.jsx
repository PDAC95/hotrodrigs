import React from "react";
import Link from "next/link";
import { formatOrderDate } from "@/lib/format";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import OrderReceipt from "@/components/orders/OrderReceipt";

/**
 * OrderDetail — the neutral, historical order view (ACCT-06).
 *
 * Presentational (no "use client"): pure props render. Wraps the shared
 * OrderReceipt body (items + totals + shipping address) with a SOBER header —
 * order number, date, and the status badge — deliberately WITHOUT the confirmation
 * island's "Thank you for your order!" success block (CONTEXT: a neutral review of
 * a past order, not a fresh post-payment receipt). Closes with a "Back to orders"
 * link to /account/orders.
 *
 * @param {{ order: object }} props
 *   order = { order_number, status, subtotal, shipping, tax, total,
 *             ship_to_snapshot, created_at, order_items } (the read.js shape)
 */
const OrderDetail = ({ order }) => {
  return (
    <>
      {/* Neutral historical header — NO thank-you block */}
      <div className='border border-gray-100 rounded-16 p-32 mb-32'>
        <div className='flex-between flex-wrap gap-16'>
          <div>
            <h5 className='mb-8 text-gray-900'>Order {order?.order_number}</h5>
            <p className='text-gray-500 mb-0'>
              Placed on {formatOrderDate(order?.created_at)}
            </p>
          </div>
          <OrderStatusBadge status={order?.status} />
        </div>
      </div>

      {/* Shared receipt body — single visual source of truth (CONTEXT) */}
      <OrderReceipt order={order} />

      <div className='d-flex flex-wrap gap-16'>
        <Link
          href='/account/orders'
          className='btn btn-outline-gray py-18 px-40 rounded-8'
        >
          Back to orders
        </Link>
      </div>
    </>
  );
};

export default OrderDetail;
