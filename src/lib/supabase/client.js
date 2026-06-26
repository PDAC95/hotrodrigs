import { createBrowserClient } from "@supabase/ssr";

// Browser anon client (Pattern 1). RLS-enforced; safe to use in client components.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
