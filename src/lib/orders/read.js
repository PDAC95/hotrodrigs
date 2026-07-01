import "server-only"; // owner-scoped reads — never reaches the client bundle

import { createClient } from "@/lib/supabase/server";

/**
 * RLS-scoped order reads for the logged-in customer (ACCT-06).
 *
 * Both Plan 03 pages (order list + order detail) consume these. They mirror the
 * /account page pattern: async, RLS anon cookie client (createClient) + getUser —
 * NEVER the service-role admin client. RLS's read-own policy scopes every row to
 * auth.uid(), so a customer can only ever see their own orders (Foundation/01-03).
 */

/**
 * List the current user's orders, most recent first (CONTEXT: no pagination).
 * Unauthenticated -> [] (the page redirects/handles). Returns [] on any error.
 *
 * @returns {Promise<Array<{ order_number: string, status: string, total: number, created_at: string }>>}
 */
export async function getOrdersForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("order_number, status, total, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[orders] getOrdersForUser failed:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Read a single order (with its line items) by order_number, RLS-scoped.
 * Unauthenticated -> null. RLS hides another customer's order, so maybeSingle
 * returns null — the detail page shows "Order not found" and never leaks existence.
 * Returns null on any error.
 *
 * @param {string} orderNumber
 * @returns {Promise<object|null>}
 */
export async function getOrderByNumber(orderNumber) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, status, subtotal, shipping, tax, total, ship_to_snapshot, created_at, order_items:order_items(name_snapshot, sku_snapshot, unit_price, quantity)"
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    console.error("[orders] getOrderByNumber failed:", error);
    return null;
  }
  return data ?? null;
}
