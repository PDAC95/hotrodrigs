// scripts/check-asset-404.mjs — asset-404 gate (CLN-04).
//
// Walks every live route (static + dynamic samples + the branded 404 page) in
// headless Chromium and fails on ANY same-origin 404 response. Because it
// listens at the network layer (page.on("response")) it catches CSS url()
// fonts/background images and JS-loaded assets that HTML parsing misses.
//
// Prereqs (the preflight below fails fast if missing):
//   1. supabase start          (local stack up — dynamic samples query the DB)
//   2. npm run dev             (or: npm run build && npm run start)
//
// Run:  npm run check:assets   (= node --env-file=.env.local scripts/check-asset-404.mjs)
//
// Env knobs:
//   BASE_URL                    server origin (default http://localhost:3000)
//   CHECK_ASSETS_L1             override /c/[l1] sample        (e.g. /c/exterior)
//   CHECK_ASSETS_L2             override /c/[l1]/[l2] sample   (e.g. /c/exterior/bumpers)
//   CHECK_ASSETS_PRODUCT        override /product/[slug] sample
//   CHECK_ASSETS_ORDER          override /account/orders/[order_number] sample
//   CHECK_ASSETS_EMAIL/_PASSWORD  log in first so /account*+/admin* render their
//                               real chrome (skipped with a warning when absent)
//
// Playwright is imported ONLY here in scripts/ — never from src/ (keeps the
// leak gate and the client bundle clean).

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PROBE = "/definitely-not-a-page"; // deliberate 404 page visit — its own
// document-level 404 is expected and excluded; asset 404s on it still count.

const STATIC_ROUTES = [
  "/",
  "/cart",
  "/checkout",
  "/checkout/confirmation",
  "/contact",
  "/login",
  "/register",
  "/search",
  "/account",
  "/admin",
  PROBE,
];

// ---------------------------------------------------------------------------
// Preflight — fail fast with actionable instructions instead of 20 timeouts.
// ---------------------------------------------------------------------------
try {
  await fetch(BASE, { redirect: "manual" });
} catch {
  console.error(
    `check:assets PREFLIGHT FAILED — nothing answering at ${BASE}.\n` +
      "Start the stack first:\n" +
      "  1. supabase start\n" +
      "  2. npm run dev   (or: npm run build && npm run start)\n" +
      "Then re-run: npm run check:assets"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Dynamic samples — inline service-role client (offline-script precedent from
// scripts/etl/lib/load.mjs; src/lib/supabase/admin.js is `import "server-only"`
// so it cannot be imported here). Env overrides win; DB fills the gaps.
// ---------------------------------------------------------------------------
async function resolveDynamicRoutes() {
  const routes = {
    l1: process.env.CHECK_ASSETS_L1 ?? null,
    l2: process.env.CHECK_ASSETS_L2 ?? null,
    product: process.env.CHECK_ASSETS_PRODUCT ?? null,
    order: process.env.CHECK_ASSETS_ORDER ?? null,
  };
  const missing = Object.values(routes).some((v) => v === null);
  if (!missing) return Object.values(routes);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "check:assets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing " +
        "(run via `npm run check:assets` so --env-file=.env.local loads them), " +
        "and no CHECK_ASSETS_* overrides supplied for the dynamic samples."
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (!routes.l1 || !routes.l2) {
    const { data: child, error } = await supabase
      .from("categories")
      .select("slug, parent_id")
      .not("parent_id", "is", null)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !child) {
      console.error("check:assets: could not sample an L2 category:", error?.message ?? "no rows");
      process.exit(1);
    }
    const { data: parent } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", child.parent_id)
      .single();
    routes.l1 ??= `/c/${parent.slug}`;
    routes.l2 ??= `/c/${parent.slug}/${child.slug}`;
  }

  if (!routes.product) {
    const { data: product, error } = await supabase
      .from("products")
      .select("slug")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !product) {
      console.error("check:assets: could not sample a product:", error?.message ?? "no rows");
      process.exit(1);
    }
    routes.product = `/product/${product.slug}`;
  }

  if (!routes.order) {
    const { data: order } = await supabase
      .from("orders")
      .select("order_number")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Order numbers carry a leading "#" (e.g. "#HRR-10001") — percent-encode it,
    // matching how OrderList/Confirmation build the link. No orders yet? The
    // detail page renders its full chrome for unknown orders too, so probe one.
    routes.order = `/account/orders/${encodeURIComponent(order?.order_number ?? "#HRR-1")}`;
  }

  return [routes.l1, routes.l2, routes.product, routes.order];
}

const dynamicRoutes = await resolveDynamicRoutes();
const routes = [...STATIC_ROUTES, ...dynamicRoutes];

// ---------------------------------------------------------------------------
// Walk the routes with a network-layer 404 listener.
// ---------------------------------------------------------------------------
const origin = new URL(BASE).origin;
const failures = [];
let currentRoute = "(none)";

const browser = await chromium.launch();
const page = await browser.newPage();

page.on("response", (res) => {
  let url;
  try {
    url = new URL(res.url());
  } catch {
    return;
  }
  if (url.origin !== origin || res.status() !== 404) return;
  // The probe's own 404 is the expected branded not-found response (document
  // request AND Next's RSC/prefetch re-fetch of the same pathname) — only
  // *asset* 404s (different pathnames) count on that route.
  if (url.pathname === PROBE) return;
  failures.push(`404 ${url.pathname} on ${currentRoute}`);
});

// Optional authenticated coverage: real /account* + /admin* chrome.
const email = process.env.CHECK_ASSETS_EMAIL;
const password = process.env.CHECK_ASSETS_PASSWORD;
if (email && password) {
  currentRoute = "/login (auth setup)";
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  try {
    await Promise.all([
      page.waitForURL("**/account*", { timeout: 15000 }),
      page.click('button[type="submit"]:has-text("Log in")'),
    ]);
  } catch {
    console.error(
      `check:assets: login as ${email} FAILED (landed on ${page.url()}). ` +
        "Fix CHECK_ASSETS_EMAIL/CHECK_ASSETS_PASSWORD or unset them to run unauthenticated. " +
        "Local seed creds: user-a@test.local / test-password-a (supabase/seed.sql)."
    );
    await browser.close();
    process.exit(1);
  }
  console.log(`check:assets: logged in as ${email} — /account*+/admin* get real chrome`);
} else {
  console.warn(
    "check:assets: CHECK_ASSETS_EMAIL/CHECK_ASSETS_PASSWORD not set — " +
      "checking /account*+/admin* unauthenticated (login-rendered chrome, still real)."
  );
}

for (const route of routes) {
  currentRoute = route;
  // "load" + a bounded networkidle settle: pages that poll forever (e.g. the
  // /checkout/confirmation order-poller) never reach networkidle — the response
  // listener still captures every asset fetched inside the settle window.
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

await browser.close();

if (failures.length) {
  console.error(`ASSET 404s (${failures.length}):\n` + failures.join("\n"));
  process.exit(1);
}
console.log(`check:assets PASS — ${routes.length} routes, zero asset 404s`);
