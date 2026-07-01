/**
 * Order status mapping — the customer NEVER sees the raw DB enum (CONTEXT).
 *
 * fulfill_order inserts orders with status 'paid' (migration), so 'paid' MUST
 * read as "Processing" for the customer until Phase 8 admin marks it 'fulfilled'.
 *
 * tone is a stable token the badge maps to Bootstrap utility classes.
 */

const STATUS_META = {
  paid: { label: "Processing", tone: "processing" },
  processing: { label: "Processing", tone: "processing" },
  fulfilled: { label: "Fulfilled", tone: "fulfilled" },
  needs_refund: { label: "Refunded", tone: "refunded" },
};

// Safe default: a freshly-paid or unknown status reads as "Processing" rather
// than leaking a raw enum or an empty badge.
const DEFAULT_META = { label: "Processing", tone: "processing" };

/**
 * Map a DB order status to a friendly { label, tone } pair.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, tone: string }}
 */
export function orderStatusMeta(status) {
  return STATUS_META[status] ?? DEFAULT_META;
}
