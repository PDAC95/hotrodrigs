"use client";

/**
 * AddToCartButton (CART-01) — wires the PDP's previously-inert Add-To-Cart button
 * to the cart layer. Driven by the selected variant lifted out of VariantSelector
 * (PdpPurchasePanel passes it in as `variant`).
 *
 * Auth-aware:
 *  - logged-in: addToCartAction(variant.id, qty) → returned {lines,count} hydrate
 *    the drawer + badge via CartProvider.
 *  - guest:     addGuestItem(variant.id, qty) (localStorage), then
 *    getGuestCartAction(newLines) for server-derived display lines.
 *
 * The quantity stepper is capped client-side at variant.stock (UX only — the
 * server re-validates + caps on every write). stock <= 0 disables the button and
 * shows "Out of stock" (CONTEXT cap rule + Pitfall 8).
 */

import React, { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { addToCartAction, getGuestCartAction } from "@/lib/cart/actions";
import { addGuestItem } from "@/lib/cart/guest-store";
import { useCart } from "@/components/cart/CartProvider";

const AddToCartButton = ({ variant }) => {
  const { setCount, setLines, openDrawer } = useCart();

  const stock = Number(variant?.stock ?? 0);
  const hasVariant = !!variant;
  const outOfStock = !hasVariant || stock <= 0;

  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  // Reset / clamp the quantity whenever the selected variant (and its stock) changes.
  useEffect(() => {
    setQty((q) => {
      if (stock <= 0) return 1;
      return Math.min(Math.max(1, q), stock);
    });
  }, [variant, stock]);

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => (stock > 0 ? Math.min(stock, q + 1) : q));

  const atMax = useMemo(() => stock > 0 && qty >= stock, [qty, stock]);

  const handleAdd = async () => {
    if (outOfStock || loading) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Logged-in: server mutates + returns the fresh cart.
        const { lines, count } = await addToCartAction(variant.id, qty);
        setLines(lines ?? []);
        setCount(count ?? 0);
      } else {
        // Guest: store intent locally, re-derive display lines on the server.
        const newLines = addGuestItem(variant.id, qty);
        const { lines } = await getGuestCartAction(newLines);
        setLines(lines ?? []);
        // guest-store emits hrr-cart-changed → CartProvider recomputes the badge,
        // but set it optimistically too so the drawer count is instant.
        setCount(newLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0));
      }
      openDrawer();
    } catch {
      // Server re-validation owns correctness; surface nothing fancy in v1.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mt-32'>
      {!outOfStock && (
        <div className='flex-align gap-16 mb-16'>
          <span className='text-gray-900 fw-medium'>Quantity</span>
          <div className='d-flex rounded-4 overflow-hidden'>
            <button
              type='button'
              onClick={dec}
              disabled={qty <= 1}
              className='quantity__minus border border-end border-gray-100 flex-shrink-0 h-48 w-48 text-neutral-600 flex-center hover-bg-main-600 hover-text-white'
            >
              <i className='ph ph-minus' />
            </button>
            <input
              type='number'
              className='quantity__input flex-grow-1 border border-gray-100 border-start-0 border-end-0 text-center w-32 px-4'
              value={qty}
              min={1}
              max={stock}
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
          {stock > 0 && stock <= 5 && (
            <span className='text-sm text-warning-600 fw-medium'>
              Only {stock} left
            </span>
          )}
        </div>
      )}

      <button
        type='button'
        onClick={handleAdd}
        disabled={outOfStock || loading}
        aria-disabled={outOfStock || loading}
        className='btn btn-main flex-center gap-8 rounded-8 py-16 fw-normal w-100'
        title={outOfStock ? "Out of stock" : "Add to cart"}
      >
        {loading ? (
          <>
            <span
              className='spinner-border spinner-border-sm'
              role='status'
              aria-hidden='true'
            />
            Adding…
          </>
        ) : outOfStock ? (
          <>
            <i className='ph ph-x-circle text-lg' />
            Out of stock
          </>
        ) : (
          <>
            <i className='ph ph-shopping-cart-simple text-lg' />
            Add To Cart
          </>
        )}
      </button>
    </div>
  );
};

export default AddToCartButton;
