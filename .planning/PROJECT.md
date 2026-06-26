# Hot Rod Rigs

## What This Is

Hot Rod Rigs is an e-commerce store for truck parts and accessories (lighting, exterior, interior, electrical, wheels, exhaust, etc.), sourced from the UP Auto catalog. It is being built on top of the existing MarketPro Next.js template (using its "design 2" / orange theme) and turned into a fully functional single-store online shop with real product data, accounts, live shipping rates, and Stripe checkout.

## Core Value

A truck owner can find the right part for their specific truck (by category or by truck make/model) and buy it online with a smooth, trustworthy checkout.

## Requirements

### Validated

(None yet — ship to validate)

### Active

<!-- Hypotheses until shipped and validated. -->

**Catalog & Data**
- [ ] Final, cleaned product database loaded into Supabase (parent/variant model, ~10,263 parents / 10,849 variants)
- [ ] Two-level navigation (11 sections → 147 subcategories) browsable by customers
- [ ] Product listing pages driven by Supabase data (replacing hardcoded template data)
- [ ] Product detail page with variant selector (size + pack) and image gallery

**Search & Discovery**
- [ ] Text search across products
- [ ] Filter/browse by category (section → subcategory)
- [ ] Search/filter parts by truck compatibility (make/model) — key v1 feature

**Accounts**
- [ ] Customer must create an account / log in to purchase (Supabase Auth)
- [ ] Customer can view their order history

**Cart & Checkout**
- [ ] Functional cart with real state and persistence
- [ ] Live shipping rate calculation via carrier API (uses weight/dimensions, handles LTL/oversized)
- [ ] Stripe embedded payment (Payment Element)
- [ ] Order created and confirmed via Stripe webhook

**Admin**
- [ ] Admin panel to manage products, prices, and stock
- [ ] Admin panel to view and process orders

### Out of Scope

- Multi-vendor marketplace — Hot Rod Rigs is a single store; template's vendor features are removed
- Template design variants 1 and 3 — only design 2 is used
- Self-hosting product images — using supplier image URLs directly for now
- Digital products / services — physical truck parts only

## Context

- **Source template:** MarketPro multi-vendor e-commerce Next.js template. Currently UI-only with hardcoded data, no backend, no working cart/checkout/auth. Heavy jQuery + Bootstrap 5 (not Tailwind). Three design variants exist; only "design 2" (orange / `color-two`) is kept.
- **Catalog source:** UP Auto truck parts (truck.upauto.com). Five working versions of the catalog exist in `bd/` (.xlsx), evolving from the raw supplier export to a parent/variant model with a navigation map. Best version of structure = `Catalogo_Truck_Final.xlsx`; richest column set (10 images, shipping/LTL, Prop 65, OEM, manuals) = `Catalogo_Truck_Limpio.xlsx`. Final DB must merge both.
- **Data cleanup needed:** fix broken encoding (e.g. "Freightliner �"), normalize "Compatible Trucks" (make/model) into its own table for filtering, merge structure + rich columns.
- **Region:** catalog is "LCAN" (US/Canada) pricing — selling region likely US/Canada.
- **Pricing:** sell at MSRP (already in data).

## Constraints

- **Tech stack**: Next.js 15 (App Router) + React 18, plain JavaScript (.jsx, no TypeScript) — keep template's stack
- **Styling**: Bootstrap 5 + jQuery + SCSS (template's system) — not Tailwind
- **Backend/DB**: Supabase (Postgres + Auth + Storage)
- **Payments**: Stripe with embedded Payment Element (not hosted Checkout)
- **Shipping**: live carrier rates via API (carrier/provider TBD, e.g. EasyPost)
- **Catalog scale**: ~10,849 variant SKUs — listing/search must perform well at this size

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on MarketPro template, design 2 | Already owned, good-looking, saves UI work | — Pending |
| Single store (not marketplace) | Hot Rod Rigs sells its own products | — Pending |
| Supabase for DB/Auth/Storage | Fast to stand up, Postgres, good free tier | — Pending |
| Stripe embedded Payment Element | Keep customer on-site, more visual control | — Pending |
| Parent/variant product model | Customer sees one product, picks size/pack; cleaner browsing | — Pending |
| Sell at MSRP | Price already in supplier data | — Pending |
| Account required to purchase | Wants registered customers / order history | — Pending |
| Live shipping rates via API | Accurate cost for heavy/oversized truck parts | — Pending |
| Truck-compatibility search in v1 | Core differentiator for truck-parts buyers | — Pending |
| Admin panel in v1 | Needs to manage products + orders directly | — Pending |

---
*Last updated: 2026-06-26 after initialization*
