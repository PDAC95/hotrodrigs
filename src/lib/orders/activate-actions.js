"use server";

/**
 * ACCT-03 — guest account activation from the confirmation page.
 *
 * A guest checkout auto-creates a confirmed account (see resolveOrCreateUser),
 * flagged `app_metadata.guest_checkout: true`. This server action lets the buyer
 * set that account's password right on the confirmation screen and get signed in,
 * closing the guest→account loop without depending on email delivery.
 *
 * Security: the caller must prove they made the purchase by supplying the
 * PaymentIntent id AND its client_secret from the confirmation URL — the server
 * re-fetches the PI from Stripe and checks it is `succeeded` with a matching
 * client_secret. A password is only ever set on an UNACTIVATED guest account
 * (guest_checkout && !activated); a proof-of-purchase can NEVER reset a real,
 * pre-existing account (that path returns `registered` → "please log in").
 */

import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD = 8;

export async function activateGuestAccount({ piId, clientSecret, password }) {
  if (!piId || !clientSecret) return { ok: false, error: "invalid_request" };
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return { ok: false, error: "weak_password" };
  }

  // 1) Proof of purchase — the PI must exist, be paid, and the caller must hold
  //    its client_secret (only returned to the buyer's own checkout session).
  let pi;
  try {
    pi = await getStripe().paymentIntents.retrieve(piId);
  } catch {
    return { ok: false, error: "invalid_request" };
  }
  if (!pi || pi.status !== "succeeded" || pi.client_secret !== clientSecret) {
    return { ok: false, error: "invalid_request" };
  }

  const admin = createAdminClient();

  // 2) The buyer email + order for this PI (service-role; guests have no session).
  const { data: pending } = await admin
    .from("pending_orders")
    .select("email")
    .eq("stripe_pi_id", piId)
    .maybeSingle();
  const { data: orderRow } = await admin
    .from("orders")
    .select("order_number")
    .eq("stripe_pi_id", piId)
    .maybeSingle();

  const email = pending?.email;
  if (!email || !orderRow) return { ok: false, error: "not_ready" };

  // 3) Resolve the auto-created account by email (indexed O(1) helper).
  const { data: userId } = await admin.rpc("user_id_by_email", { p_email: email });
  if (!userId) return { ok: false, error: "no_account" };

  const { data: userRes } = await admin.auth.admin.getUserById(userId);
  const appMeta = userRes?.user?.app_metadata ?? {};

  // Guard: only an unactivated guest auto-account may have its password set here.
  if (appMeta.guest_checkout !== true) return { ok: false, error: "registered" };
  if (appMeta.activated === true) return { ok: false, error: "already_activated" };

  // 4) Set the password + mark the account activated.
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { ...appMeta, guest_checkout: true, activated: true },
  });
  if (updateError) return { ok: false, error: "update_failed" };

  // 5) Sign the buyer in on the RLS cookie client so they land in their history.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) return { ok: false, error: "signin_failed" };

  return { ok: true, orderNumber: orderRow.order_number };
}
