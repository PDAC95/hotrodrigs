/**
 * Shared display helpers — used on BOTH client and server (no "server-only" here).
 *
 * Single source of truth for how the storefront renders money and order dates so
 * the confirmation island, the order-list page, and the order-detail page all
 * agree (CONTEXT: human-readable currency + date, one shared helper).
 */

/**
 * Format a numeric (dollars) value as "$X.XX".
 * Returns the em-dash "—" for null/undefined so an absent line reads gracefully.
 * Identical behavior to the confirmation island's previous inline helper, so the
 * receipt is unchanged when it switches to this shared version.
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatPrice(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(2)}`;
}

/**
 * Format an ISO/timestamptz string (or Date) as a human-readable date, e.g.
 * "Jul 1, 2026". Returns "" for null/invalid input.
 *
 * @param {string|Date|null|undefined} value
 * @returns {string}
 */
export function formatOrderDate(value) {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
