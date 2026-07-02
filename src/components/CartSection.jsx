"use client";

/**
 * CartSection — the /cart page body. Replaces the hardcoded 4-row template table
 * with real, server-derived cart lines (CART-04: price/stock re-derived from
 * product_variants; the client holds only {variant_id, quantity}).
 *
 * Source selection on mount:
 *   - logged-in: getCartAction()
 *   - guest:     getGuestCartAction(getGuestCart())
 * Re-loads on every `hrr-cart-changed` event (guest mutations) and after each
 * logged-in mutation. Qty/remove route through the right layer per source.
 *
 * Totals: Subtotal = sum of line_subtotal (the read already zeroes out-of-stock
 * lines, so they are excluded — CONTEXT). Shipping (Phase 5) and tax (Phase 6)
 * are NOT computed here. Total = Subtotal.
 *
 * Checkout is open to guests (ACCT-03): the button routes guests straight to
 * /checkout (cart preserved in localStorage as guest_cart); the webhook auto-creates
 * an account from the guest email so the order can be claimed later. Logged-in users
 * get "Proceed to checkout"; a "Log in" link stays available for returning customers.
 *
 * Empty state: friendly message + CTA to the store (no product suggestions).
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import {
  getCartAction,
  getGuestCartAction,
  updateCartItemAction,
  removeCartItemAction,
} from "@/lib/cart/actions";
import {
  getGuestCart,
  updateGuestItem,
  removeGuestItem,
} from "@/lib/cart/guest-store";
import { useCart } from "@/components/cart/CartProvider";
import CartLine from "@/components/cart/CartLine";

function formatPrice(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

const CartSection = () => {
  const { setCount, setLines: setProviderLines } = useCart();

  const [lines, setLines] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load cart lines from the correct source.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const loggedIn = !!user;
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        const { lines: srvLines, count } = await getCartAction();
        setLines(srvLines ?? []);
        setProviderLines(srvLines ?? []);
        setCount(count ?? 0);
      } else {
        const guest = getGuestCart();
        const { lines: derived } = await getGuestCartAction(guest);
        setLines(derived ?? []);
        setProviderLines(derived ?? []);
      }
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [setCount, setProviderLines]);

  useEffect(() => {
    load();
    if (typeof window === "undefined") return;
    const onChange = () => load();
    window.addEventListener("hrr-cart-changed", onChange);
    return () => window.removeEventListener("hrr-cart-changed", onChange);
  }, [load]);

  // Quantity change — qty 0 removes (handled by the underlying layer).
  const handleUpdateQty = useCallback(
    async (variantId, qty) => {
      if (isLoggedIn) {
        const { lines: srvLines, count } = await updateCartItemAction(
          variantId,
          qty
        );
        setLines(srvLines ?? []);
        setProviderLines(srvLines ?? []);
        setCount(count ?? 0);
      } else {
        const newGuest = updateGuestItem(variantId, qty);
        const { lines: derived } = await getGuestCartAction(newGuest);
        setLines(derived ?? []);
        setProviderLines(derived ?? []);
        // guest-store emits hrr-cart-changed → provider recomputes the badge.
      }
    },
    [isLoggedIn, setCount, setProviderLines]
  );

  const handleRemove = useCallback(
    async (variantId) => {
      if (isLoggedIn) {
        const { lines: srvLines, count } = await removeCartItemAction(variantId);
        setLines(srvLines ?? []);
        setProviderLines(srvLines ?? []);
        setCount(count ?? 0);
      } else {
        const newGuest = removeGuestItem(variantId);
        const { lines: derived } = await getGuestCartAction(newGuest);
        setLines(derived ?? []);
        setProviderLines(derived ?? []);
      }
    },
    [isLoggedIn, setCount, setProviderLines]
  );

  // Subtotal excludes out-of-stock lines (their line_subtotal is already 0).
  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.line_subtotal || 0),
    0
  );

  // Empty state.
  if (!loading && lines.length === 0) {
    return (
      <section className='cart py-80'>
        <div className='container container-lg'>
          <div className='text-center py-80'>
            <i className='ph ph-shopping-cart text-6xl text-gray-300 d-block mb-24' />
            <h5 className='mb-12'>Your cart is empty</h5>
            <p className='text-gray-500 mb-32'>
              Browse our heavy-duty truck parts and add the ones that fit your
              rig.
            </p>
            <Link href='/' className='btn btn-main rounded-8 px-40 py-16'>
              Browse parts
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className='cart py-80'>
      <div className='container container-lg'>
        <div className='row gy-4'>
          <div className='col-xl-9 col-lg-8'>
            <div className='cart-table border border-gray-100 rounded-8 px-40 py-48'>
              <div className='overflow-x-auto scroll-sm scroll-sm-horizontal'>
                <table className='table style-three'>
                  <thead>
                    <tr>
                      <th className='h6 mb-0 text-lg fw-bold'>Delete</th>
                      <th className='h6 mb-0 text-lg fw-bold'>Product Name</th>
                      <th className='h6 mb-0 text-lg fw-bold'>Price</th>
                      <th className='h6 mb-0 text-lg fw-bold'>Quantity</th>
                      <th className='h6 mb-0 text-lg fw-bold'>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && lines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className='text-center text-gray-500 py-32'>
                          Loading your cart…
                        </td>
                      </tr>
                    ) : (
                      lines.map((line) => (
                        <tr key={line.variant_id}>
                          <CartLine
                            line={line}
                            onUpdateQty={handleUpdateQty}
                            onRemove={handleRemove}
                          />
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className='col-xl-3 col-lg-4'>
            <div className='cart-sidebar border border-gray-100 rounded-8 px-24 py-40'>
              <h6 className='text-xl mb-32'>Cart Totals</h6>
              <div className='bg-color-three rounded-8 p-24'>
                <div className='mb-0 flex-between gap-8'>
                  <span className='text-gray-900 font-heading-two'>
                    Subtotal
                  </span>
                  <span className='text-gray-900 fw-semibold'>
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>
              <div className='bg-color-three rounded-8 p-24 mt-24'>
                <div className='flex-between gap-8'>
                  <span className='text-gray-900 text-xl fw-semibold'>
                    Total
                  </span>
                  <span className='text-gray-900 text-xl fw-semibold'>
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>
              <span className='text-sm text-gray-500 d-block mt-16'>
                Shipping and taxes are calculated at checkout.
              </span>

              {isLoggedIn ? (
                <Link
                  href='/checkout'
                  className='btn btn-main mt-32 py-18 w-100 rounded-8'
                >
                  Proceed to checkout
                </Link>
              ) : (
                <>
                  <Link
                    href='/checkout'
                    className='btn btn-main mt-32 py-18 w-100 rounded-8'
                  >
                    Check out as guest
                  </Link>
                  <span className='text-sm text-gray-500 d-block mt-12 text-center'>
                    Have an account?{" "}
                    <Link href='/login' className='text-main-600'>
                      Log in
                    </Link>{" "}
                    — we&apos;ll create one for you at checkout either way.
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CartSection;
