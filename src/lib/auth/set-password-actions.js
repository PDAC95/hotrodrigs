"use server";

/**
 * EML-02 — set-password server action for the guest-activation landing page.
 *
 * The activation email's recovery link (verifyOtp in /auth/confirm) signs the
 * guest in, so this action runs WITH a session: updateUser on the RLS cookie
 * client changes the CURRENT session's password. It then flips
 * app_metadata.activated on guest accounts so BOTH activation paths (this one
 * and the confirmation-page activateGuestAccount) stay consistent — that
 * action guards on the flag.
 *
 * redirect() throws internally — never wrap it in a try/catch that swallows it.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setPassword(formData) {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) {
    redirect("/account/set-password?error=weak_password");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/account"); // no session -> normal login flow

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/account/set-password?error=update_failed");

  // Keep BOTH activation paths consistent (activate-actions.js guards on this
  // flag). Best-effort: the password IS set even if the flag write fails.
  const appMeta = user.app_metadata ?? {};
  if (appMeta.guest_checkout === true && appMeta.activated !== true) {
    const { error: metaError } =
      await createAdminClient().auth.admin.updateUserById(user.id, {
        app_metadata: { ...appMeta, activated: true },
      });
    if (metaError) {
      console.error("[email] activated-flag update failed (non-fatal):", metaError);
    }
  }

  redirect("/account/orders");
}
