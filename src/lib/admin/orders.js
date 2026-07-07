"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendOnce } from "@/lib/email/send";
import { orderFulfilledEmail } from "@/lib/email/templates";

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
 * The buyer email is not stored on `orders` (Phase 7 FIX-01: it lives on
 * `pending_orders`, keyed by the same order_number). We resolve it in a second
 * admin-gated read and attach it as `email` so the list can show a Customer
 * column. Legacy rows with no order_number (early $0 test orders) simply get null.
 *
 * @returns {Promise<Array<{ id: number, order_number: string, status: string, total: number, created_at: string, user_id: string|null, email: string|null, name: string|null }>>}
 */
export async function getAllOrders() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, user_id, ship_to_snapshot")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/orders] getAllOrders failed:", error);
    return [];
  }

  const orders = data ?? [];
  const orderNumbers = orders
    .map((o) => o.order_number)
    .filter((n) => n != null);

  // Resolve buyer emails from pending_orders (admin RLS returns all rows).
  const emailByOrder = new Map();
  if (orderNumbers.length > 0) {
    const { data: pending, error: pendingError } = await supabase
      .from("pending_orders")
      .select("order_number, email")
      .in("order_number", orderNumbers);
    if (pendingError) {
      console.error("[admin/orders] email lookup failed:", pendingError);
    } else {
      for (const p of pending ?? []) {
        if (p.order_number && p.email) emailByOrder.set(p.order_number, p.email);
      }
    }
  }

  return orders.map((o) => ({
    ...o,
    email: emailByOrder.get(o.order_number) ?? null,
    name: o.ship_to_snapshot?.name ?? null,
  }));
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
 * Transition guard (EML-03): `.neq("status", status)` makes a same-status re-save
 * match 0 rows — a success-no-op (still `{ ok: true }`, the admin never sees an
 * error toast for a double-save), and no email fires. Only a REAL transition to
 * "fulfilled" attempts the order-fulfilled email, and even then sendOnce's
 * (order_number, 'order_fulfilled') claim in sent_emails is PERMANENT: a
 * fulfilled → processing → fulfilled flip-flop does NOT resend. Once per order
 * EVER — a deliberate decision for a single-operator store, not an accident.
 * Email failures are try/catch-walled and can never break the status update.
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

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("order_number", orderNumber)
    .neq("status", status) // no-op re-save matches 0 rows
    .select("order_number, status, ship_to_snapshot");

  if (error) {
    console.error("[admin/orders] updateOrderStatus failed:", error);
    return { ok: false, error: "update_failed" };
  }

  // Fulfilled email — ONLY when a row actually transitioned AND the new status is
  // "fulfilled". The buyer email lives on pending_orders (same order_number key —
  // Phase 7 FIX-01, mirrors getAllOrders above). Wrapped so an email failure can
  // never change the action result: the status write above already succeeded.
  if (updated?.length > 0 && status === "fulfilled") {
    try {
      const { data: pendingRow } = await supabase
        .from("pending_orders")
        .select("email")
        .eq("order_number", orderNumber)
        .maybeSingle();
      const buyerEmail = pendingRow?.email ?? null;
      if (buyerEmail) {
        const message = orderFulfilledEmail({
          orderNumber: updated[0].order_number,
          shipTo: updated[0].ship_to_snapshot ?? null,
        });
        await sendOnce({
          orderNumber: updated[0].order_number,
          emailType: "order_fulfilled",
          to: buyerEmail,
          ...message,
        });
      } else {
        console.warn(
          `[email] no buyer email for ${orderNumber} — skipping fulfilled email`
        );
      }
    } catch (emailErr) {
      console.error(
        `[email] fulfilled email failed for ${orderNumber} (non-fatal):`,
        emailErr
      );
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderNumber}`);

  // 0 rows updated + no error = already that status (or unknown order): a
  // success-no-op, NOT a failure — no email was sent, but the admin UI must not
  // toast an error for re-saving the same status.
  return { ok: true, status };
}
