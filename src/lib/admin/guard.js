import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Admin app-layer gate (ADM-01).
//
// This gate reuses the Phase 1 admin mechanism: the `user_role='admin'` JWT
// claim injected by the custom access token hook — the EXACT signal that
// `public.is_admin()` reads in RLS. Because the app-layer redirect and the DB
// write-gate consult the same claim, they can never disagree.
//
// RLS is still the real enforcement (admin-write policies gated on
// `(select public.is_admin())`); this gate is a UX redirect so non-admins
// never see the admin chrome.
//
// We read the claim via `supabase.auth.getClaims()`, which verifies the JWT
// signature server-side rather than trusting a stale cookie decode.
//
// NEVER use createAdminClient() here — the service-role client bypasses RLS
// and defeats the entire purpose of this gate. Always the RLS cookie client.
//
// NOTE (Phase 1 behavior): the bootstrap admin must have refreshed their
// session at least once for the `user_role` claim to be present in the JWT.

// Server gate for /admin/**. Redirects signed-out users to /login and
// signed-in non-admins to /account (a plain redirect matches the /account
// pattern and does not leak that /admin exists as a distinct resource).
// On success returns the admin identity for callers that want it.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data) {
    // Signed out.
    redirect("/login");
  }

  if (data.claims?.user_role !== "admin") {
    // Signed in, but not an admin.
    redirect("/account");
  }

  return { userId: data.claims.sub, email: data.claims.email };
}

// Non-redirecting boolean check for conditional UI (e.g. a storefront "Admin"
// link). Reads the same verified user_role claim as requireAdmin().
export async function isAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.user_role === "admin";
}
