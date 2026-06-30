"use server";

/**
 * Cart Server Actions (CART-01..03) — thin, serializable wrappers over the
 * server-only data layer so client buttons/forms (Add to cart, qty steppers,
 * the cart drawer) can invoke mutations directly without a route handler.
 *
 * Each action returns plain serializable objects: the fresh cart lines + count,
 * so a single round-trip both performs the mutation AND hydrates the drawer/badge.
 */

import {
  addToCart,
  updateCartItem,
  removeCartItem,
  getCartLines,
  getCartCount,
  getGuestCartLines,
  mergeGuestCart,
} from "./server";

/** Snapshot the logged-in cart (lines + badge count) for the client. */
async function cartSnapshot() {
  const [lines, count] = await Promise.all([getCartLines(), getCartCount()]);
  return { lines, count };
}

/**
 * Add/merge a variant, then return the fresh cart so the caller updates the
 * drawer and badge in one round-trip.
 */
export async function addToCartAction(variantId, qty = 1) {
  await addToCart(variantId, qty);
  return cartSnapshot();
}

/** Set a variant's absolute quantity (qty 0 removes), then return the fresh cart. */
export async function updateCartItemAction(variantId, qty) {
  await updateCartItem(variantId, qty);
  return cartSnapshot();
}

/** Remove a variant, then return the fresh cart. */
export async function removeCartItemAction(variantId) {
  await removeCartItem(variantId);
  return cartSnapshot();
}

/** Logged-in cart read for the /cart page + drawer hydration. */
export async function getCartAction() {
  return cartSnapshot();
}

/**
 * Server-side re-derivation of a GUEST cart. The client passes only
 * [{variant_id, quantity}]; price/stock come back LIVE from product_variants.
 */
export async function getGuestCartAction(guestLines) {
  const lines = await getGuestCartLines(guestLines);
  return { lines };
}

/**
 * Fold a guest cart into the DB cart on login (called once by Plan 03), then
 * return the unified logged-in cart so the UI can swap to it.
 */
export async function mergeGuestCartAction(guestLines) {
  await mergeGuestCart(guestLines);
  return cartSnapshot();
}
