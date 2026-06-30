"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mergeGuestCart } from "@/lib/cart/server";

// All auth mutations run server-side on the RLS-enforced cookie client
// (createClient) — never the service-role admin client. Cookie-setting stays
// here, never in a page render.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export async function signIn(formData) {
  const email = formData.get("email");
  const password = formData.get("password");
  const guestCartRaw = formData.get("guest_cart");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  // MERGE-ON-LOGIN (Option A — server-side): the browser Supabase client never
  // emits SIGNED_IN for a session created in this Server Action, so the only
  // reliable place to fire the verified mergeGuestCart is here, with the
  // cookie-bound RLS client. LoginForm forwarded the localStorage guest cart as
  // a hidden `guest_cart` JSON field.
  let guestLines = [];
  try {
    const parsed = JSON.parse(guestCartRaw || "[]");
    if (Array.isArray(parsed)) guestLines = parsed;
  } catch {}

  let merged = false;
  if (guestLines.length > 0) {
    try {
      // mergeGuestCart already caps at live stock and is additive — do NOT change it.
      // Swallow merge errors: a login must still succeed even if the merge hiccups.
      await mergeGuestCart(guestLines);
      merged = true;
    } catch {}
  }

  revalidatePath("/", "layout");
  // The cart_merged flag is the soft-nav signal CartProvider consumes to clear
  // the guest localStorage cart and re-sync the badge + lines without a reload.
  redirect(merged ? "/account?cart_merged=1" : "/account");
}

export async function signUp(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: SITE_URL + "/auth/confirm?next=/account",
    },
  });

  if (error) {
    redirect("/register?error=" + encodeURIComponent(error.message));
  }

  // Email confirmation is required — do NOT log the user in here.
  redirect("/register?check_email=1");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: SITE_URL + "/auth/callback?next=/account",
    },
  });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  if (data?.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
