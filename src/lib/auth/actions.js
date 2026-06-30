"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// All auth mutations run server-side on the RLS-enforced cookie client
// (createClient) — never the service-role admin client. Cookie-setting stays
// here, never in a page render.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export async function signIn(formData) {
  const email = formData.get("email");
  const password = formData.get("password");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/", "layout");
  redirect("/account");
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
