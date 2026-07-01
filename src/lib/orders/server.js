import "server-only"; // never reaches the client bundle — service-role only

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ACCT-03 — resolve or create the buyer's account by email (service-role).
 *
 * - Existing email  -> return its user id (link the order, never a duplicate).
 * - New email       -> create a confirmed user + email them a recovery (set-password)
 *                      link so a guest can later sign in to see their order.
 *
 * Never blocks order creation: if account resolution genuinely fails, log and
 * return null so the order is still created with user_id null (a later sign-in
 * with that email can be linked in Phase 7). CONTEXT: link to existing, never
 * force login.
 *
 * The existing-user lookup is O(1) by email via the public.user_id_by_email
 * SECURITY DEFINER helper (indexed auth.users query) — NOT auth.admin.listUsers,
 * which scans/pages the whole user table.
 *
 * @param {string} email
 * @returns {Promise<string|null>} user id, or null if resolution failed
 */
export async function resolveOrCreateUser(email) {
  if (!email) return null;
  const admin = createAdminClient();

  try {
    // O(1) lookup by email — links to an existing account with no duplicate.
    const { data: existingId, error: lookupError } = await admin.rpc(
      "user_id_by_email",
      { p_email: email }
    );
    if (lookupError) throw lookupError;
    if (existingId) return existingId;

    // No account yet — create a confirmed user, then send a set-password link.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({ email, email_confirm: true });

    if (createError) {
      // Race: another delivery/tab created the account between lookup and insert.
      const code = createError.code || createError.message || "";
      if (String(code).includes("email_exists")) {
        const { data: raceId } = await admin.rpc("user_id_by_email", {
          p_email: email,
        });
        return raceId ?? null;
      }
      throw createError;
    }

    // Guest gets a recovery link so they can set a password and access their order.
    try {
      await admin.auth.admin.generateLink({ type: "recovery", email });
    } catch (linkError) {
      // Non-fatal: the account exists; the link email is a convenience, not a gate.
      console.error("[orders] generateLink failed (non-fatal):", linkError);
    }

    return created?.user?.id ?? null;
  } catch (err) {
    // Account resolution must never block the order (CONTEXT).
    console.error("[orders] resolveOrCreateUser failed (non-fatal):", err);
    return null;
  }
}

/**
 * Create the order from a staged pending_orders row via the idempotent
 * fulfill_order RPC (idempotent on stripe_pi_id + atomic per-line stock
 * decrement). Resolves the buyer's account first (ACCT-03).
 *
 * A genuine oversell surfaces as a typed { code: 'insufficient_stock' } error so
 * the webhook handler can refund instead of looping (Pitfall 4). All other RPC
 * errors are rethrown so the webhook returns 500 and Stripe safely retries.
 *
 * @param {object} pending - a public.pending_orders row
 * @returns {Promise<number>} the created (or existing) order id
 */
export async function createOrderFromIntent(pending) {
  const admin = createAdminClient();

  const userId = pending.user_id ?? (await resolveOrCreateUser(pending.email));

  const { data: orderId, error } = await admin.rpc("fulfill_order", {
    p_stripe_pi_id: pending.stripe_pi_id,
    p_order_number: pending.order_number,
    p_user_id: userId,
    p_ship_to: pending.ship_to_snapshot,
    p_subtotal: pending.subtotal,
    p_shipping: pending.shipping,
    p_tax: pending.tax,
    p_total: pending.total,
    p_tax_calculation_id: pending.tax_calculation_id,
    p_notes: pending.notes,
    p_lines: pending.lines,
  });

  if (error) {
    if (String(error.message || "").includes("insufficient_stock")) {
      // Typed error so the handler refunds rather than retries (permanent failure).
      const oversell = new Error(error.message);
      oversell.code = "insufficient_stock";
      throw oversell;
    }
    throw error;
  }

  return orderId;
}
