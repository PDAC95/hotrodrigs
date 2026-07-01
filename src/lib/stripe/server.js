import "server-only";

import Stripe from "stripe";

/**
 * Server-only lazy Stripe client singleton.
 *
 * `import "server-only"` is the leak-gate: this module (and STRIPE_SECRET_KEY)
 * can NEVER be pulled into the client bundle — same discipline as the EasyPost,
 * cart, and catalog data layers. The secret is a plain server env var; it is NOT
 * NEXT_PUBLIC_ and must never reach the browser (Pitfall 7). Only
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is safe on the client (06-04).
 *
 * LAZY instantiation (mirrors easypost-client.js): `new Stripe(key)` is deferred
 * to the first getStripe() call — a live request — so importing this module (and
 * therefore building any route that imports it) needs no key. Eager construction
 * at import time would break `next build` "Collecting page data" whenever
 * STRIPE_SECRET_KEY is absent (USER SETUP / Pitfall 8).
 *
 * apiVersion is pinned to the version the installed SDK (stripe@22.3.0) reports
 * so upgrades are explicit, not implicit.
 */
let _stripe;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return _stripe;
}
