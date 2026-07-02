"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin order data layer + fulfillment mutation (ADM-04).
 *
 * These run through the RLS cookie client (createClient) — NOT the service-role
 * admin client. The admin's JWT carries user_role='admin' (Phase 1 custom access
 * token hook), so the Phase 1 `orders_admin_all` / `order_items_admin_all`
 * policies (`for all to authenticated using ((select public.is_admin()))`) let
 * these queries read+write ALL orders regardless of user_id, while a non-admin
 * (should one ever reach here) is blocked by RLS at the DB — the real guarantee.
 * The /admin layout already redirects non-admins as a UX gate.
 *
 * This is a "use server" module, so EVERY export must be an async function
 * (server action rules). The reads are async too, which satisfies that.
 */

/**
 * Every order, most recent first — NOT owner-scoped (admin RLS returns all rows).
 * Returns [] on error.
 *
 * @returns {Promise<Array<{ id: number, order_number: string, status: string, total: number, created_at: string, user_id: string|null }>>}
 */
export async function getAllOrders() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, user_id")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/orders] getAllOrders failed:", error);
    return [];
  }
  return data ?? [];
}

/**
 * A single order (+ its line items) by order_number, NOT owner-scoped — the admin
 * RLS policy returns it regardless of user_id. Mirrors the column set from
 * src/lib/orders/read.js getOrderByNumber so the shared OrderReceipt renders
 * identically. Returns null on missing/error.
 *
 * @param {string} orderNumber
 * @returns {Promise<object|null>}
 */
export async function getAdminOrderByNumber(orderNumber) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, status, subtotal, shipping, tax, total, ship_to_snapshot, created_at, order_items:order_items(name_snapshot, sku_snapshot, unit_price, quantity)"
    )
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    console.error("[admin/orders] getAdminOrderByNumber failed:", error);
    return null;
  }
  return data ?? null;
}

// The only operational states an admin may SET from the status control. 'paid'
// (what fulfill_order inserts) collapses to "Processing" for display, and
// 'needs_refund' is a payment-driven terminal state the admin cannot set here.
const SETTABLE_STATUSES = ["processing", "fulfilled"];

/**
 * updateOrderStatus — the fulfillment mutation (server action).
 *
 * Reads order_number + status from the submitted form, VALIDATES status against
 * the allow-list (never trust the client), updates the orders row via the RLS
 * cookie client (admin-write gated by orders_admin_all), then revalidates the
 * admin list + detail so the new badge renders on re-render. A non-admin's update
 * matches zero rows / is denied by RLS.
 *
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, status?: string, error?: string }>}
 */
export async function updateOrderStatus(formData) {
  const orderNumber = formData.get("order_number");
  const status = formData.get("status");

  if (!SETTABLE_STATUSES.includes(status)) {
    return { ok: false, error: "invalid_status" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("order_number", orderNumber);

  if (error) {
    console.error("[admin/orders] updateOrderStatus failed:", error);
    return { ok: false, error: "update_failed" };
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderNumber}`);

  return { ok: true, status };
}
