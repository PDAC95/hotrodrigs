import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAddress } from "@/lib/shipping/address";
import {
  getShippingCartLines,
  getShippingCartLinesFromGuest,
} from "@/lib/shipping/cart-read";
import { quoteCart } from "@/lib/shipping/quote";

/**
 * POST /api/shipping/quote
 *
 * The SINGLE server-side seam the checkout UI (05-03) and Phase 6 payment both
 * consume: validate -> verify address -> read the shipping cart -> quoteCart.
 * The client only ever sends an address (+ a guest_cart for guests); it NEVER
 * sends an amount (CART-04 discipline extended to shipping). All rate policy —
 * curation, fallback, freight routing, staleness — lives behind quoteCart.
 *
 * Mirrors the /api/cart/count server-only data wall: the EasyPost client and the
 * RLS cart-read stay server-side; nothing here is bundled to the client.
 *
 * force-dynamic so a quote is never served stale from the route cache (the cart
 * read is per-session and EasyPost rates are live).
 */
export const dynamic = "force-dynamic";

// Locked geographic scope: US + CA (RESEARCH / CONTEXT).
const bodySchema = z.object({
  address: z.object({
    street1: z.string().min(1),
    street2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(1),
    country: z.enum(["US", "CA"]),
  }),
  // Present when the caller is a guest; logged-in callers omit it and the server
  // reads their RLS cart.
  guest_cart: z
    .array(
      z.object({
        variant_id: z.union([z.number(), z.string()]),
        quantity: z.number(),
      })
    )
    .optional(),
});

/**
 * Small stable hash of a string -> short base36 token. Used to key the quote
 * cache on (cart lines + address) so changing either invalidates (Pitfall 7).
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0; // 32-bit
  }
  return (h >>> 0).toString(36);
}

export async function POST(req) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const { address, guest_cart } = parsed.data;

    // Verify the destination. Unverified -> 200 with a suggestion (the UI shows
    // the suggestion inline, not an error page).
    const v = await verifyAddress(address);
    if (!v.verified) {
      return NextResponse.json({
        verified: false,
        suggestion: v.suggestion,
        errors: v.errors,
      });
    }

    // Read shipping lines: guest body when present, else the logged-in RLS cart.
    const lines = guest_cart?.length
      ? await getShippingCartLinesFromGuest(guest_cart)
      : await getShippingCartLines();

    if (lines.length === 0) {
      return NextResponse.json({
        verified: true,
        empty: true,
        parcel: { options: [] },
        freight: null,
      });
    }

    // Cache key: variant ids+quantities + verified destination (zip/country).
    const ids = lines
      .map((l) => `${l.variant_id}:${l.effective_qty}`)
      .sort()
      .join(",");
    const cacheKey = hashString(
      JSON.stringify({ ids, zip: address.zip, country: address.country })
    );

    const quote = await quoteCart({ lines, toAddress: address, cacheKey });

    return NextResponse.json({ verified: true, ...quote });
  } catch {
    // quoteCart already swallows EasyPost failures internally; an error here is
    // unexpected. The client's own spinner-timeout fallback (05-03) covers a 500.
    return NextResponse.json({ error: "quote_failed" }, { status: 500 });
  }
}
