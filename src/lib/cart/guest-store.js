"use client";

/**
 * localStorage store for the GUEST cart (CART-03 / CART-04).
 *
 * Guests have no Postgres cart row (carts is per-user, NOT NULL user_id), so a
 * not-logged-in shopper's cart lives entirely client-side until they sign in,
 * at which point Plan 03 calls mergeGuestCartAction to fold it into their DB cart.
 *
 * STORED SHAPE — an array of `{ variant_id, quantity }` ONLY. We NEVER store a
 * price, name, stock, or any catalog field client-side: those are authoritative
 * on the server and are always re-derived from product_variants on read (the
 * structural guarantee behind CART-04). The stock CAP is likewise enforced
 * server-side; these helpers only track intent (variant + desired quantity).
 *
 * Every accessor mirrors truck-storage.js: guarded by `typeof window` so it is a
 * no-op during SSR, and wrapped in try/catch so corrupt/blocked storage degrades
 * to an empty cart instead of throwing.
 *
 * On every mutation we dispatch a window CustomEvent (`CART_EVENT`) so Plan 03's
 * header badge and cart drawer can react without prop drilling — zero-dependency,
 * matching the existing repo pattern (plain helpers, no Zustand).
 */

const STORAGE_KEY = "hrr.cart";
const CART_EVENT = "hrr-cart-changed";

/** Notify listeners (header counter, drawer) that the guest cart changed. */
function emitChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(CART_EVENT));
  } catch {
    // Event constructor unavailable (very old env) -> silent no-op.
  }
}

/**
 * Read the persisted guest cart.
 * @returns {{ variant_id:number, quantity:number }[]} [] on missing/corrupt/SSR.
 */
export function getGuestCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normalize: keep only well-formed {variant_id, quantity>0} entries.
    return parsed
      .filter(
        (l) =>
          l &&
          Number.isFinite(Number(l.variant_id)) &&
          Number.isFinite(Number(l.quantity)) &&
          Number(l.quantity) > 0
      )
      .map((l) => ({
        variant_id: Number(l.variant_id),
        quantity: Number(l.quantity),
      }));
  } catch {
    return [];
  }
}

/**
 * Overwrite the persisted guest cart and emit a change event.
 * @param {{ variant_id:number, quantity:number }[]} lines
 */
export function setGuestCart(lines) {
  if (typeof window === "undefined") return;
  try {
    const safe = Array.isArray(lines)
      ? lines
          .filter((l) => l && Number(l.quantity) > 0)
          .map((l) => ({
            variant_id: Number(l.variant_id),
            quantity: Number(l.quantity),
          }))
      : [];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Storage full or blocked (private mode) -> cart lives only in memory/URL.
  }
  emitChange();
}

/**
 * Add `qty` of a variant, merging by variant_id (sum). The authoritative stock
 * cap is applied server-side on read — here we only record intent.
 * @returns {{ variant_id:number, quantity:number }[]} the new cart array.
 */
export function addGuestItem(variantId, qty = 1) {
  const id = Number(variantId);
  const add = Math.max(1, Math.trunc(Number(qty) || 1));
  const lines = getGuestCart();
  const existing = lines.find((l) => l.variant_id === id);
  if (existing) {
    existing.quantity += add;
  } else {
    lines.push({ variant_id: id, quantity: add });
  }
  setGuestCart(lines);
  return lines;
}

/**
 * Set the absolute quantity for a variant. qty <= 0 removes the line.
 * @returns {{ variant_id:number, quantity:number }[]} the new cart array.
 */
export function updateGuestItem(variantId, qty) {
  const id = Number(variantId);
  const next = Math.trunc(Number(qty) || 0);
  let lines = getGuestCart();
  if (next <= 0) {
    lines = lines.filter((l) => l.variant_id !== id);
  } else {
    const existing = lines.find((l) => l.variant_id === id);
    if (existing) existing.quantity = next;
    else lines.push({ variant_id: id, quantity: next });
  }
  setGuestCart(lines);
  return lines;
}

/**
 * Remove a variant entirely.
 * @returns {{ variant_id:number, quantity:number }[]} the new cart array.
 */
export function removeGuestItem(variantId) {
  const id = Number(variantId);
  const lines = getGuestCart().filter((l) => l.variant_id !== id);
  setGuestCart(lines);
  return lines;
}

/** Empty the guest cart (e.g. after a successful merge-on-login). */
export function clearGuestCart() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emitChange();
}

/**
 * Sum of quantities for the header badge. Pass `lines` to avoid a re-read, or
 * omit to read from storage.
 * @returns {number}
 */
export function guestCartCount(lines) {
  const ls = Array.isArray(lines) ? lines : getGuestCart();
  return ls.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
}

export { STORAGE_KEY, CART_EVENT };
