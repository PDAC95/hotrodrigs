import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Per-request cookie-aware server anon client (Pattern 2). RLS-enforced.
// Uses the getAll/setAll cookie interface required by @supabase/ssr — the old
// get/set/remove interface is removed and breaks at runtime.
export async function createClient() {
  const cookieStore = await cookies(); // Next 15: cookies() is async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — refresh happens in middleware
          }
        },
      },
    }
  );
}
