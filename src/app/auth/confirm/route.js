import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// SSR email-confirmation flow. Supabase calls this GET with token_hash + type
// (the confirmation email template MUST be the token_hash/PKCE style:
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account` —
// the default `{{ .ConfirmationURL }}` does NOT carry these params. The template
// override lives in supabase/config.toml [auth.email.template.confirmation] /
// supabase/templates/confirmation.html; for hosted projects set it in
// Supabase Studio -> Auth -> Email Templates).
// verifyOtp sets the session cookie server-side, then we land the user on `next`.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Only allow same-origin relative paths to prevent open-redirect via `next`
  // (mirrors the validation in /auth/callback). Reject protocol-relative (//)
  // and backslash-based (/\) bypasses.
  let next = searchParams.get("next") ?? "/account";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    next = "/account";
  }

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
}
