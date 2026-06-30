"use client";

/**
 * MiniCartDrawer — a slide-in panel that opens when an item is added to the cart
 * (openDrawer() from CartProvider). Lists the cart lines (compact CartLine), a
 * server-derived subtotal, and links to /cart + checkout (checkout is Phase 6, so
 * it points to /cart for now).
 *
 * Mounted once, globally, inside <CartProvider> in the root layout. Reads
 * lines/isDrawerOpen from useCart(). Backdrop click or the close button closes it.
 */

import React from "react";
import Link from "next/link";

import { useCart } from "@/components/cart/CartProvider";
import CartLine from "@/components/cart/CartLine";

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

const MiniCartDrawer = () => {
  const { isDrawerOpen, closeDrawer, lines } = useCart();

  // Subtotal excludes out-of-stock lines (their line_subtotal is already 0).
  const subtotal = (lines ?? []).reduce(
    (sum, l) => sum + Number(l.line_subtotal || 0),
    0
  );
  const itemCount = (lines ?? []).reduce(
    (sum, l) => sum + Number(l.quantity || 0),
    0
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        aria-hidden={!isDrawerOpen}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          opacity: isDrawerOpen ? 1 : 0,
          visibility: isDrawerOpen ? "visible" : "hidden",
          transition: "opacity 0.25s ease, visibility 0.25s ease",
          zIndex: 1050,
        }}
      />

      {/* Panel */}
      <aside
        role='dialog'
        aria-label='Mini cart'
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(380px, 90vw)",
          background: "#fff",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
          transform: isDrawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          zIndex: 1060,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className='flex-between p-24 border-bottom border-gray-100'>
          <h6 className='mb-0'>Your Cart ({itemCount})</h6>
          <button
            type='button'
            onClick={closeDrawer}
            className='text-2xl text-gray-500 hover-text-main-600 d-flex'
            aria-label='Close cart'
          >
            <i className='ph ph-x' />
          </button>
        </div>

        <div
          className='px-24'
          style={{ flexGrow: 1, overflowY: "auto" }}
        >
          {(!lines || lines.length === 0) ? (
            <div className='text-center py-48'>
              <i className='ph ph-shopping-cart text-4xl text-gray-300 d-block mb-12' />
              <p className='text-gray-500 mb-16'>Your cart is empty</p>
              <Link
                href='/'
                onClick={closeDrawer}
                className='btn btn-main rounded-8 px-24 py-12'
              >
                Browse parts
              </Link>
            </div>
          ) : (
            lines.map((line) => (
              <CartLine key={line.variant_id} line={line} compact />
            ))
          )}
        </div>

        {lines && lines.length > 0 && (
          <div className='p-24 border-top border-gray-100'>
            <div className='flex-between mb-16'>
              <span className='text-gray-900 fw-medium'>Subtotal</span>
              <span className='text-gray-900 fw-semibold'>
                {formatPrice(subtotal)}
              </span>
            </div>
            <Link
              href='/cart'
              onClick={closeDrawer}
              className='btn btn-outline-main w-100 rounded-8 py-12 mb-12'
            >
              View cart
            </Link>
            <Link
              href='/cart'
              onClick={closeDrawer}
              className='btn btn-main w-100 rounded-8 py-12'
            >
              Checkout
            </Link>
          </div>
        )}
      </aside>
    </>
  );
};

export default MiniCartDrawer;
