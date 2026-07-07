// scripts/sass-visual-check.mjs — Phase 10 Sass-migration visual gate (throwaway tooling).
//
// Captures full-page screenshots of the 6 roadmap pages (home, PLP, PDP, cart,
// checkout, account) at 2 viewports against a running PROD server, then
// pixel-compares before/after runs with pixelmatch. Route sampling, preflight,
// env overrides, login flow, and the bounded-settle gotcha are copied from
// scripts/check-asset-404.mjs (the solved patterns).
//
// Prereqs for `capture` (the preflight below fails fast if missing):
//   1. supabase start                      (dynamic samples query the DB)
//   2. npm run build && npm start          (prod server — NEVER the dev server)
//
// Usage:
//   node --env-file=.env.local scripts/sass-visual-check.mjs capture before
//   node --env-file=.env.local scripts/sass-visual-check.mjs capture after
//   node scripts/sass-visual-check.mjs compare
//
// Env knobs (same contract as check-asset-404.mjs):
//   BASE_URL                     server origin (default http://localhost:3000)
//   CHECK_ASSETS_L2              override /c/[l1]/[l2] PLP sample
//   CHECK_ASSETS_PRODUCT         override /product/[slug] PDP sample
//   CHECK_ASSETS_EMAIL/_PASSWORD login creds (default: seed.sql's
//                                user-a@test.local / test-password-a — the
//                                SEED convention, not Password123@)
//
// Output: scripts/sass-artifacts/screens-{before,after,diff}/<slug>-<viewport>.png
// Playwright/pixelmatch are imported ONLY here in scripts/ — never from src/.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { createClient } from "@supabase/supabase-js";

const ART_DIR = "scripts/sass-artifacts";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SUPABASE_PROBE = process.env.SUPABASE_URL ?? "http://127.0.0.1:54431";

const EMAIL = process.env.CHECK_ASSETS_EMAIL ?? "user-a@test.local";
const PASSWORD = process.env.CHECK_ASSETS_PASSWORD ?? "test-password-a";

const VIEWPORTS = [
  { tag: "desktop", width: 1920, height: 1080 },
  { tag: "mobile", width: 390, height: 844 },
];

// pixelmatch sensitivity + per-pair budget: both runs render identical DOM with
// (expected-)identical CSS, so real regressions show as large deltas, not noise.
const THRESHOLD = 0.1;
const BUDGET_RATIO = 0.0005; // diff pixels must stay < 0.05% of total pixels

// Freeze animations/transitions/caret so before/after captures are deterministic.
const FREEZE_CSS =
  "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

const [, , mode, runName] = process.argv;

function usageExit() {
  console.error(
    "Usage:\n" +
      "  node --env-file=.env.local scripts/sass-visual-check.mjs capture before|after\n" +
      "  node scripts/sass-visual-check.mjs compare"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Dynamic samples — inline service-role client (offline-script precedent from
// scripts/check-asset-404.mjs). Env overrides win; the DB fills the gaps.
// ---------------------------------------------------------------------------
async function resolvePages() {
  let l2 = process.env.CHECK_ASSETS_L2 ?? null;
  let product = process.env.CHECK_ASSETS_PRODUCT ?? null;

  if (!l2 || !product) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error(
        "sass-visual-check: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing " +
          "(run via `node --env-file=.env.local ...` so they load), and no " +
          "CHECK_ASSETS_L2 / CHECK_ASSETS_PRODUCT overrides supplied."
      );
      process.exit(1);
    }
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!l2) {
      const { data: child, error } = await supabase
        .from("categories")
        .select("slug, parent_id")
        .not("parent_id", "is", null)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !child) {
        console.error(
          "sass-visual-check: could not sample an L2 category:",
          error?.message ?? "no rows"
        );
        process.exit(1);
      }
      const { data: parent } = await supabase
        .from("categories")
        .select("slug")
        .eq("id", child.parent_id)
        .single();
      l2 = `/c/${parent.slug}/${child.slug}`;
    }

    if (!product) {
      const { data: row, error } = await supabase
        .from("products")
        .select("slug")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !row) {
        console.error(
          "sass-visual-check: could not sample a product:",
          error?.message ?? "no rows"
        );
        process.exit(1);
      }
      product = `/product/${row.slug}`;
    }
  }

  // The 6 roadmap pages. Stable slugs keep before/after filenames pairable
  // even if the DB sample changes between runs (it shouldn't — same DB).
  return [
    { slug: "home", route: "/" },
    { slug: "plp", route: l2 },
    { slug: "pdp", route: product },
    { slug: "cart", route: "/cart" },
    { slug: "checkout", route: "/checkout" },
    { slug: "account", route: "/account" },
  ];
}

// ---------------------------------------------------------------------------
// capture before|after
// ---------------------------------------------------------------------------
async function capture(run) {
  // Preflight — fail fast with actionable instructions instead of 12 timeouts.
  try {
    await fetch(BASE, { redirect: "manual" });
  } catch {
    console.error(
      `sass-visual-check PREFLIGHT FAILED — nothing answering at ${BASE}.\n` +
        "Start the PROD server first (never the dev server):\n" +
        "  1. supabase start\n" +
        "  2. npm run build && npm start\n" +
        `Then re-run: node --env-file=.env.local scripts/sass-visual-check.mjs capture ${run}`
    );
    process.exit(1);
  }
  try {
    await fetch(SUPABASE_PROBE, { redirect: "manual" });
  } catch {
    console.error(
      `sass-visual-check PREFLIGHT FAILED — Supabase not answering at ${SUPABASE_PROBE}.\n` +
        "Run `supabase start` first (dynamic samples + app pages query the DB)."
    );
    process.exit(1);
  }

  const pages = await resolvePages();
  console.log(
    `sass-visual-check: capturing '${run}' — PLP=${pages[1].route} PDP=${pages[2].route}`
  );

  const outDir = path.join(ART_DIR, `screens-${run}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: "reduce",
    });
    // Kill slick/react-slick AUTOPLAY: both tick via setInterval(>=~2000ms),
    // so each capture otherwise catches a different carousel rotation (10-03
    // saw the home 'Deal of The Week' slider offset by 2 slides between runs).
    // Swallowing long intervals pins every carousel at slide 0 on BOTH runs.
    // Short intervals (<500ms) pass through; Preloader uses setTimeout — untouched.
    await context.addInitScript(() => {
      const origSetInterval = window.setInterval;
      window.setInterval = function (fn, delay, ...args) {
        if (typeof delay === "number" && delay >= 500) return 0;
        return origSetInterval.call(window, fn, delay, ...args);
      };
    });
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Log in first so /account renders the real dashboard chrome (seed creds).
    await page.goto(BASE + "/login", { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    try {
      await Promise.all([
        page.waitForURL("**/account*", { timeout: 15000 }),
        page.click('button[type="submit"]:has-text("Log in")'),
      ]);
    } catch {
      console.error(
        `sass-visual-check: login as ${EMAIL} FAILED (landed on ${page.url()}). ` +
          "Local seed creds: user-a@test.local / test-password-a (supabase/seed.sql). " +
          "Override with CHECK_ASSETS_EMAIL / CHECK_ASSETS_PASSWORD."
      );
      await browser.close();
      process.exit(1);
    }

    for (const pg of pages) {
      // "load" + a bounded networkidle settle: pages that poll forever (e.g.
      // the /checkout/confirmation order-poller) never reach networkidle —
      // copied verbatim from check-asset-404.mjs.
      await page.goto(BASE + pg.route, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      // Preloader.jsx unmounts div.preloader via a 1000ms setTimeout — CSS
      // freezing does NOT stop it, but a fast capture can beat it and shoot a
      // preloader-covered page (10-03 caught the pdp baseline like that).
      await page
        .waitForSelector(".preloader", { state: "detached", timeout: 15000 })
        .catch(() => {});
      await page.addStyleTag({ content: FREEZE_CSS });
      await page.evaluate(() => document.fonts.ready);
      // Extra bounded settle: lets slick/wow finish their post-load layout so
      // both runs land in the same final state (10-03 saw a bistable home).
      await page.waitForTimeout(1500);
      const file = path.join(outDir, `${pg.slug}-${vp.tag}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  captured ${pg.slug}-${vp.tag}.png (${pg.route})`);
    }

    await context.close();
  }

  await browser.close();

  const count = fs.readdirSync(outDir).filter((f) => f.endsWith(".png")).length;
  console.log(`sass-visual-check: '${run}' capture complete — ${count} PNGs in ${outDir}`);
  if (count !== VIEWPORTS.length * pages.length) {
    console.error(
      `sass-visual-check: expected ${VIEWPORTS.length * pages.length} PNGs, found ${count}`
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// compare — pixelmatch every before/after pair, write diff PNGs, budget-gate.
// ---------------------------------------------------------------------------
function compare() {
  const beforeDir = path.join(ART_DIR, "screens-before");
  const afterDir = path.join(ART_DIR, "screens-after");
  const diffDir = path.join(ART_DIR, "screens-diff");

  for (const [label, dir] of [["before", beforeDir], ["after", afterDir]]) {
    if (!fs.existsSync(dir)) {
      console.error(
        `sass-visual-check: ${dir} missing — run \`capture ${label}\` first.`
      );
      process.exit(1);
    }
  }
  fs.mkdirSync(diffDir, { recursive: true });

  const names = fs.readdirSync(beforeDir).filter((f) => f.endsWith(".png")).sort();
  if (names.length === 0) {
    console.error(`sass-visual-check: no PNGs in ${beforeDir}.`);
    process.exit(1);
  }

  let failed = false;
  for (const name of names) {
    const afterPath = path.join(afterDir, name);
    if (!fs.existsSync(afterPath)) {
      console.error(`FAIL ${name}: missing in screens-after/`);
      failed = true;
      continue;
    }
    const a = PNG.sync.read(fs.readFileSync(path.join(beforeDir, name)));
    const b = PNG.sync.read(fs.readFileSync(afterPath));
    if (a.width !== b.width || a.height !== b.height) {
      // Dimension mismatch = layout change (page height moved) = automatic fail.
      console.error(
        `FAIL ${name}: dimensions differ — before ${a.width}x${a.height}, after ${b.width}x${b.height}`
      );
      failed = true;
      continue;
    }
    const diff = new PNG({ width: a.width, height: a.height });
    const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
      threshold: THRESHOLD,
    });
    const total = a.width * a.height;
    const budget = Math.floor(total * BUDGET_RATIO);
    const pct = ((diffPixels / total) * 100).toFixed(4);
    fs.writeFileSync(path.join(diffDir, name), PNG.sync.write(diff));
    if (diffPixels > budget) {
      console.error(
        `FAIL ${name}: ${diffPixels} diff pixels (${pct}%) exceeds budget ${budget} (<0.05%) — see ${path.join(diffDir, name)}`
      );
      failed = true;
    } else {
      console.log(`PASS ${name}: ${diffPixels} diff pixels (${pct}%) within budget ${budget}`);
    }
  }

  if (failed) {
    console.error("sass-visual-check compare: FAIL — inspect scripts/sass-artifacts/screens-diff/");
    process.exit(1);
  }
  console.log(`sass-visual-check compare: PASS — ${names.length} pairs pixel-identical within budget`);
}

// ---------------------------------------------------------------------------
if (mode === "capture" && (runName === "before" || runName === "after")) {
  await capture(runName);
} else if (mode === "compare") {
  compare();
} else {
  usageExit();
}
