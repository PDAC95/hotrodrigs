import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Session-refresh middleware (Pattern 4). MUST call supabase.auth.getUser() to
// trigger token refresh; setAll writes refreshed cookies onto the response.
// Without this, sessions silently expire and RLS reads return empty.
export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token. Do not run code between createServerClient and
  // getUser() — it can cause hard-to-debug session termination.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
