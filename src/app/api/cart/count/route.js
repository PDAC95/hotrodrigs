import { NextResponse } from "next/server";
import { getCartCount } from "@/lib/cart/server";

/**
 * GET /api/cart/count  ->  { count }
 *
 * The client HeaderTwo cannot import the `server-only` cart layer (the same wall
 * Phase 3 solved with /api/fitment/*), so it polls this route for the logged-in
 * cart badge. The GUEST badge is driven entirely client-side by the guest-store;
 * this route serves ONLY the logged-in count and returns 0 when there is no
 * session (getCartCount returns 0 for a null cart).
 *
 * force-dynamic so the count is never served stale from the route cache.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await getCartCount();
    return NextResponse.json({ count });
  } catch {
    // No session / transient error -> empty badge, never a 500 to the header.
    return NextResponse.json({ count: 0 });
  }
}
