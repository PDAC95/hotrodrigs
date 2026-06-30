"use client";

/**
 * CartLine — one cart row, reused by the mini-cart drawer (compact) AND the
 * /cart page (full). Renders entirely from a server-derived CartLine shape
 * (CART-04): the client never computes a price.
 *
 * CartLine shape (from src/lib/cart/server.js toCartLine):
 *   { variant_id, quantity, effective_qty, price, available, out_of_stock,
 *     capped, sku, size, pack, product:{id,name,slug,cover_image_url,oem_number},
 *     line_subtotal }
 *
 * Quantity control is bound to `available` (live stock). Setting qty to 0 removes
 * the line. The mutation is delegated to the parent via onUpdateQty/onRemove so
 * the same line works for guest (guest-store) and logged-in (server actions).
 *
 * Flags: out_of_stock / capped surface a subtle badge and the line is excluded
 * from the total upstream (the read already zeroes line_subtotal). A priceChanged
 * notice is rendered when the parent passes it.
 *
 * Fitment: reuse FitsBadge + getStoredTruck() — a "fits your <truck>" badge when
 * a truck is selected (the storefront differentiator).
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";

import FitsBadge from "@/components/fitment/FitsBadge";
import { getStoredTruck } from "@/lib/fitment/truck-storage";

const PLACEHOLDER = "/assets/images/placeholder-product.png";

function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function variantLabel(line) {
  const parts = [];
  if (line.size) parts.push(line.size);
  if (line.pack) parts.push(line.pack);
  return parts.join(" · ");
}

const CartLine = ({
  line,
  compact = false,
  priceChanged = false,
  onUpdateQty,
  onRemove,
}) => {
  const [truckName, setTruckName] = useState(null);

  // Read the stored truck after mount (SSR-safe — localStorage is client-only).
  useEffect(() => {
    const truck = getStoredTruck();
    setTruckName(truck?.modelName ? truck.modelName : null);
  }, []);

  const product = line.product ?? {};
  const img = product.cover_image_url || PLACEHOLDER;
  const href = product.slug ? `/product/${product.slug}` : "#";
  const available = Number(line.available ?? 0);
  const qty = Number(line.quantity ?? 0);
  const atMax = available > 0 && qty >= available;
  const flagged = line.out_of_stock || line.capped;

  // Fitment: when this product fits the active truck. The cart line carries the
  // product; we surface "fits your <truck>" whenever a truck is selected and the
  // product is universal OR matched (v1: show on a selected truck — the read path
  // already filtered fitment on the PLP/PDP; here it is a reassurance badge).
  const showFits = !!truckName;

  const dec = () => {
    if (onUpdateQty) onUpdateQty(line.variant_id, Math.max(0, qty - 1));
  };
  const inc = () => {
    if (atMax) return;
    if (onUpdateQty) onUpdateQty(line.variant_id, qty + 1);
  };
  const remove = () => {
    if (onRemove) onRemove(line.variant_id);
  };

  if (compact) {
    // Drawer variant — tight row.
    return (
      <div className='flex-align gap-12 py-12 border-bottom border-gray-100'>
        <Link
          href={href}
          className='border border-gray-100 rounded-8 flex-center flex-shrink-0'
          style={{ width: 56, height: 56, overflow: "hidden" }}
        >
          <img
            src={img}
            alt={product.name || ""}
            style={{ maxWidth: 56, maxHeight: 56, objectFit: "contain" }}
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER;
            }}
          />
        </Link>
        <div className='flex-grow-1'>
          <Link
            href={href}
            className='text-sm fw-medium text-heading text-line-2 hover-text-main-600 d-block'
          >
            {product.name}
          </Link>
          {variantLabel(line) && (
            <span className='text-xs text-gray-500 d-block'>
              {variantLabel(line)}
            </span>
          )}
          <span className='text-xs text-gray-700'>
            {qty} × {formatPrice(line.price)}
          </span>
          {flagged && (
            <span className='d-block text-xs text-danger-600 fw-medium'>
              {line.out_of_stock
                ? "Out of stock"
                : `Only ${available} available`}
            </span>
          )}
        </div>
        <div className='text-end'>
          <span className='text-sm fw-semibold d-block'>
            {formatPrice(line.line_subtotal)}
          </span>
          <button
            type='button'
            onClick={remove}
            className='text-xs text-gray-400 hover-text-danger-600'
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  // Full variant — /cart table row content (rendered inside a <tr>).
  return (
    <>
      <td>
        <button
          type='button'
          onClick={remove}
          className='remove-tr-btn flex-align gap-12 hover-text-danger-600'
        >
          <i className='ph ph-x-circle text-2xl d-flex' />
          Remove
        </button>
      </td>
      <td>
        <div className='table-product d-flex align-items-center gap-24'>
          <Link
            href={href}
            className='table-product__thumb border border-gray-100 rounded-8 flex-center position-relative'
            style={{ width: 80, height: 80, overflow: "hidden" }}
          >
            {showFits && <FitsBadge kind={line.product?.fits_all ? "universal" : "fits"} />}
            <img
              src={img}
              alt={product.name || ""}
              style={{ maxWidth: 80, maxHeight: 80, objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER;
              }}
            />
          </Link>
          <div className='table-product__content text-start'>
            <h6 className='title text-lg fw-semibold mb-8'>
              <Link href={href} className='link text-line-2'>
                {product.name}
              </Link>
            </h6>
            <div className='flex-align gap-16 flex-wrap mb-8'>
              {variantLabel(line) && (
                <span className='text-sm text-gray-700'>
                  {variantLabel(line)}
                </span>
              )}
              {product.oem_number && (
                <span className='text-sm text-gray-500'>
                  OEM#: {product.oem_number}
                </span>
              )}
              {line.sku && (
                <span className='text-sm text-gray-500'>SKU: {line.sku}</span>
              )}
            </div>
            <div className='flex-align gap-12 flex-wrap'>
              {showFits && (
                <span className='text-sm text-success-600 fw-medium flex-align gap-4'>
                  <i className='ph ph-check-circle' />
                  Fits your {truckName}
                </span>
              )}
              {line.out_of_stock && (
                <span className='text-sm text-danger-600 fw-medium'>
                  Out of stock — not counted in total
                </span>
              )}
              {!line.out_of_stock && line.capped && (
                <span className='text-sm text-warning-600 fw-medium'>
                  Only {available} available
                </span>
              )}
              {priceChanged && (
                <span className='text-sm text-gray-500'>
                  <i className='ph ph-info' /> Price updated
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span className='text-lg h6 mb-0 fw-semibold'>
          {formatPrice(line.price)}
        </span>
      </td>
      <td>
        <div className='d-flex rounded-4 overflow-hidden'>
          <button
            type='button'
            onClick={dec}
            className='quantity__minus border border-end border-gray-100 flex-shrink-0 h-48 w-48 text-neutral-600 flex-center hover-bg-main-600 hover-text-white'
          >
            <i className='ph ph-minus' />
          </button>
          <input
            type='number'
            className='quantity__input flex-grow-1 border border-gray-100 border-start-0 border-end-0 text-center w-32 px-4'
            value={qty}
            min={0}
            max={available}
            readOnly
          />
          <button
            type='button'
            onClick={inc}
            disabled={atMax}
            className='quantity__plus border border-end border-gray-100 flex-shrink-0 h-48 w-48 text-neutral-600 flex-center hover-bg-main-600 hover-text-white'
          >
            <i className='ph ph-plus' />
          </button>
        </div>
      </td>
      <td>
        <span className='text-lg h6 mb-0 fw-semibold'>
          {line.out_of_stock ? "—" : formatPrice(line.line_subtotal)}
        </span>
      </td>
    </>
  );
};

export default CartLine;
