import React from "react";
import Link from "next/link";
import { formatPrice, formatOrderDate } from "@/lib/format";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";

/**
 * OrderList — the customer's order-history table (ACCT-04).
 *
 * Presentational (no "use client"): pure props render. Given the RLS-scoped list
 * from getOrdersForUser (most recent first), renders either:
 *   - the EMPTY state (icon + "No orders yet" + "Start shopping" CTA -> "/"), or
 *   - a Bootstrap table with columns Order number | Date | Total | Status. Every
 *     row deep-links to /account/orders/[order_number]; the order-number cell is a
 *     Link and the whole row carries a clickable affordance so the entire row acts
 *     as the navigation target (CONTEXT: whole-row clickable). Money + dates go
 *     through the shared format helpers; status renders via OrderStatusBadge so the
 *     raw DB enum is never shown.
 *
 * @param {{ orders: Array<{ order_number: string, status: string, total: number, created_at: string }> }} props
 */
const OrderList = ({ orders = [] }) => {
  if (orders.length === 0) {
    return (
      <div className='border border-gray-100 rounded-16 px-24 py-80 text-center'>
        <span className='text-gray-400 text-40 mb-16 d-inline-block'>
          <i className='ph ph-package' />
        </span>
        <h6 className='text-xl mb-8 text-gray-900'>No orders yet</h6>
        <p className='text-gray-500 mb-32'>
          When you place an order, it will show up here.
        </p>
        <Link href='/' className='btn btn-main py-18 px-40 rounded-8'>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className='border border-gray-100 rounded-16 px-24 py-24'>
      <h6 className='text-xl mb-24 text-gray-900'>My orders</h6>
      <div className='table-responsive'>
        <table className='table align-middle mb-0'>
          <thead>
            <tr>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Order number
              </th>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Date
              </th>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Total
              </th>
              <th scope='col' className='text-gray-500 fw-medium text-sm'>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              // order_number carries a leading "#" (e.g. "#HRR-10004"); "#" is a URL
              // fragment, so it MUST be percent-encoded or the row link never navigates.
              const href = `/account/orders/${encodeURIComponent(o.order_number)}`;
              return (
                <tr key={o.order_number} className='order-row'>
                  <td>
                    <Link
                      href={href}
                      className='text-main-600 fw-semibold text-decoration-none'
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className='text-gray-700'>
                    <Link
                      href={href}
                      className='text-gray-700 text-decoration-none d-block'
                    >
                      {formatOrderDate(o.created_at)}
                    </Link>
                  </td>
                  <td className='text-gray-900 fw-semibold'>
                    <Link
                      href={href}
                      className='text-gray-900 text-decoration-none d-block'
                    >
                      {formatPrice(o.total)}
                    </Link>
                  </td>
                  <td>
                    <Link href={href} className='text-decoration-none d-block'>
                      <OrderStatusBadge status={o.status} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderList;
