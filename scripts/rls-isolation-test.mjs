#!/usr/bin/env node
/**
 * Cross-user RLS isolation gate — Phase 01 Foundation, Plan 04, Task 2.
 *
 * Proves that Row Level Security actually isolates users: signed in as the
 * anon-key session for one seeded user, a NON-ADMIN must NEVER see another
 * user's cart/order rows. RLS applies to the anon-key JWT session, so this is
 * the real-world boundary a browser hits.
 *
 * User A is the seeded bootstrap ADMIN: the `admin_all` policies (Phase 1, by
 * design) grant them read over every row once the `user_role` JWT claim is
 * injected by the token hook (fixed in 20260702180000). So the test asserts
 * the inverse for A — an admin MUST see foreign rows. If A sees none, the
 * claim/hook chain is broken again (the exact regression Phase 8 hit).
 *
 * Fixtures come from supabase/seed.sql (run `supabase db reset` first).
 *
 * Run: npm run test:rls   (loads .env.local via --env-file)
 * Exits 0 + "PASS" when isolation holds; non-zero + "FAIL" on any leak.
 *
 * Reusable regression check for Phases 4-7.
 */
import { createClient } from "@supabase/supabase-js";

// Mirrors the credentials seeded in supabase/seed.sql (user-a is the bootstrap admin).
const USERS = [
  { label: "A", email: "user-a@test.local", password: "test-password-a", admin: true },
  { label: "B", email: "user-b@test.local", password: "test-password-b", admin: false },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "FAIL: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing. " +
      "Run via `npm run test:rls` (loads .env.local)."
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Sign in a fresh anon client as one user; return { client, id }.
 * Retries transient gateway errors: `supabase db reset` rotates container IPs
 * and Kong briefly caches a stale auth upstream (502/connection refused) until
 * it re-resolves, so the first call right after a reset can flap.
 */
async function signIn({ email, password }, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error) return { client, id: data.user.id };
    lastErr = error;
    // Retry only transient gateway/network failures, not bad credentials.
    const transient =
      error.status === 502 ||
      error.status === 503 ||
      error.status === 0 ||
      /upstream|fetch failed|network|ECONN/i.test(error.message || "");
    if (!transient) break;
    await sleep(1500);
  }
  throw new Error(
    `sign-in failed for ${email}: ${lastErr?.message || JSON.stringify(lastErr)}`
  );
}

async function main() {
  // Sign in as both users and resolve their ids up front.
  const sessions = {};
  for (const u of USERS) {
    sessions[u.label] = { ...(await signIn(u)), email: u.email };
  }

  let leaks = 0;

  for (const u of USERS) {
    const self = sessions[u.label];
    const others = USERS.filter((o) => o.label !== u.label).map((o) => sessions[o.label].id);

    for (const table of ["orders", "carts"]) {
      // Owner-scoped RLS means this select can only ever return the caller's
      // rows — unless the caller is the admin, whom admin_all lets read all.
      const { data, error } = await self.client.from(table).select("id,user_id");
      if (error) throw new Error(`query ${table} as ${u.email} failed: ${error.message}`);

      const ownRows = data.filter((r) => r.user_id === self.id).length;
      const foreignRows = data.filter((r) => others.includes(r.user_id)).length;

      if (u.admin) {
        // Admin MUST see other users' rows; zero means the user_role claim /
        // token-hook chain regressed (admin_all never matches).
        if (foreignRows > 0) {
          console.log(
            `ok: admin ${u.label} sees ${foreignRows} foreign ${table} row(s) via admin_all (claim working)`
          );
        } else {
          leaks += 1;
          console.error(
            `FAIL: admin ${u.label} sees 0 foreign ${table} rows — user_role claim/token hook broken?`
          );
        }
      } else if (foreignRows > 0) {
        leaks += foreignRows;
        console.error(
          `FAIL: user ${u.label} saw ${foreignRows} ${table} row(s) belonging to another user`
        );
      } else {
        console.log(
          `ok: user ${u.label} sees ${ownRows} own ${table} row(s), 0 foreign`
        );
      }
    }
  }

  if (leaks > 0) {
    console.error(`\nFAIL: RLS check broken — ${leaks} violation(s) (non-admin leak or admin claim regression).`);
    process.exit(1);
  }

  console.log(
    "\nPASS: RLS holds — non-admins are isolated; admin sees all rows via admin_all."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
