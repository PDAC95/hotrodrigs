/**
 * Shared stock/availability semantics (Phase 13, STOCK-01..04).
 *
 * The stock model: `stock NULL` = UNTRACKED (orderable, order-from-supplier —
 * the catalog-wide default); numeric = TRACKED (cap + atomic webhook decrement).
 * Every consumer (cart server layer, shipping cart-read, PDP/cart UI, admin
 * editors) derives availability through THESE helpers — never through raw
 * truthiness on `stock` (Number(stock) || 0 turns NULL into out-of-stock).
 *
 * Copy rules (locked): unit counts are NEVER displayed in the storefront,
 * including cap/limit messages. Admin surfaces may show counts.
 */

// The single lead-time claim (Phase 16 shipping page reuses this constant).
export const LEAD_TIME_TEXT = "3-5 business days";

// Locked availability copy.
export const IN_STOCK_LABEL = "In Stock — Ships in 3-5 Business Days";
export const OUT_OF_STOCK_LABEL = "Out of Stock";
export const CART_LEAD_TIME_LINE = `Ships in ${LEAD_TIME_TEXT}`;

// Quantity-cap inline note (no unit counts — locked).
export const MAX_QTY_NOTE = "Maximum quantity reached";

// Sanity cap for untracked lines (anti-absurd-order guard, UI/cart-level — NOT stock).
export const UNTRACKED_MAX_QTY = 10;

/** Tracked = a numeric stock value exists. NULL/undefined = untracked. */
export function isTracked(stock) {
  return stock !== null && stock !== undefined;
}

/** Orderable = untracked, or tracked with stock > 0. */
export function isOrderable(stock) {
  return !isTracked(stock) || Number(stock) > 0;
}

/** Max quantity for a line: tracked -> live stock (floored at 0), untracked -> sanity cap. */
export function maxQty(stock) {
  return isTracked(stock) ? Math.max(0, Math.trunc(Number(stock))) : UNTRACKED_MAX_QTY;
}
