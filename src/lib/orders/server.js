import "server-only"; // never reaches the client bundle — service-role only

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ACCT-03 — resolve or create the buyer's account by email (service-role).
 *
 * - Existing email  -> return its user id (link the order, never a duplicate).
 * - New email       -> create a confirmed user flagged guest_checkout; the buyer
 *                      sets its password on the confirmation page (activateGuestAccount)
 *                      to activate the account and sign in to see their order.
 *
 * Never blocks order creation: if account resolution genuinely fails, log and
 * return a null userId so the order is still created with user_id null (a later
 * sign-in with that email can be linked in Phase 7). CONTEXT: link to existing,
 * never force login.
 *
 * The existing-user lookup is O(1) by email via the public.user_id_by_email
 * SECURITY DEFINER helper (indexed auth.users query) — NOT auth.admin.listUsers,
 * which scans/pages the whole user table.
 *
 * isNewGuest is true ONLY when THIS call created the account (EML-02: only a
 * genuinely new guest account gets an activation email). Existing accounts,
 * the email_exists race loser, and every failure path return false.
 *
 * @param {string} email
 * @returns {Promise<{userId: string|null, isNewGuest: boolean}>}
 */
export async function resolveOrCreateUser(email) {
  if (!email) return { userId: null, isNewGuest: false };
  const admin = createAdminClient();

  try {
    // O(1) lookup by email — links to an existing account with no duplicate.
    const { data: existingId, error: lookupError } = await admin.rpc(
      "user_id_by_email",
      { p_email: email }
    );
    if (lookupError) throw lookupError;
    if (existingId) return { userId: existingId, isNewGuest: false };

    // No account yet — create a confirmed user, flagged as an unactivated guest
    // account. The buyer sets its password from the confirmation page (ACCT-03,
    // activateGuestAccount); the flag gates that activation so a proof-of-purchase
    // can never reset a real, pre-existing account.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { guest_checkout: true },
      });

    if (createError) {
      // Race: another delivery/tab created the account between lookup and insert.
      // The OTHER delivery created it and owns the activation email.
      const code = createError.code || createError.message || "";
      if (String(code).includes("email_exists")) {
        const { data: raceId } = await admin.rpc("user_id_by_email", {
          p_email: email,
        });
        return { userId: raceId ?? null, isNewGuest: false };
      }
      throw createError;
    }

    return {
      userId: created?.user?.id ?? null,
      isNewGuest: created?.user?.id != null,
    };
  } catch (err) {
    // Account resolution must never block the order (CONTEXT).
    console.error("[orders] resolveOrCreateUser failed (non-fatal):", err);
    return { userId: null, isNewGuest: false };
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
 * @returns {Promise<{orderId: number, isNewGuest: boolean}>} the created (or
 *   existing) order id, plus whether this fulfillment created a brand-new guest
 *   account (EML-02 activation-email trigger; always false for logged-in buyers)
 */
export async function createOrderFromIntent(pending) {
  const admin = createAdminClient();

  // Logged-in checkouts (pending.user_id set) never resolve -> isNewGuest stays
  // false (EML-02 is guests only).
  let isNewGuest = false;
  let userId = pending.user_id ?? null;
  if (!userId) {
    const resolved = await resolveOrCreateUser(pending.email);
    userId = resolved.userId;
    isNewGuest = resolved.isNewGuest;
  }

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

  return { orderId, isNewGuest };
}
