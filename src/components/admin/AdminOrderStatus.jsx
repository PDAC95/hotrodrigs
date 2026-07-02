"use client";

import React from "react";
import { updateOrderStatus } from "@/lib/admin/orders";

/**
 * AdminOrderStatus — the status change control wired to the updateOrderStatus
 * server action (ADM-04).
 *
 * Progressive enhancement: a plain <form action={serverAction}> is enough — on
 * submit the action updates the row and revalidates /admin/orders + the detail
 * route, so the page re-renders with the new badge (no useState needed). The
 * admin may only set the two settable operational states; a stored 'paid' or
 * 'processing' collapses to "processing" for the initial selection.
 *
 * @param {{ orderNumber: string, currentStatus: string }} props
 */
const AdminOrderStatus = ({ orderNumber, currentStatus }) => {
  const defaultValue = currentStatus === "fulfilled" ? "fulfilled" : "processing";

  return (
    <div className='border border-gray-100 rounded-16 p-32 mb-40'>
      <h6 className='mb-16 text-gray-900'>Update status</h6>
      <form action={updateOrderStatus} className='row gy-3 align-items-end'>
        <input type='hidden' name='order_number' value={orderNumber} />
        <div className='col-sm-8'>
          <label
            htmlFor='admin-order-status'
            className='text-gray-700 fw-medium text-sm mb-8 d-block'
          >
            Order status
          </label>
          <select
            id='admin-order-status'
            name='status'
            defaultValue={defaultValue}
            className='form-select'
          >
            <option value='processing'>Processing</option>
            <option value='fulfilled'>Fulfilled</option>
          </select>
        </div>
        <div className='col-sm-4'>
          <button type='submit' className='btn btn-main w-100 py-16 rounded-8'>
            Update status
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminOrderStatus;
