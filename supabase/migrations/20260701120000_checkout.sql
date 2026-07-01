-- Phase 06 Checkout & Payments, Plan 01 — additive DB contracts.
-- Purely additive / idempotent: create ... if not exists, add column if not exists,
-- create or replace function. NO drop, NO destructive alter, NEVER `db reset`
-- (the 10K catalog lives only in the DB, loaded via ETL — a reset would wipe it).
--
-- Provides for 06-02/06-03:
--   * public.order_number_seq        — human-readable sequential order numbers (#HRR-10001)
--   * additive public.orders columns — order_number (unique), notes, tax_calculation_id
--   * public.pending_orders          — create-intent staging, keyed on the PaymentIntent id
--   * public.fulfill_order(...)      — transactional, idempotent order fulfillment RPC

-- ===========================================================================
-- 1. order_number sequence (RESEARCH Pattern 6)
--    Only the SECURITY DEFINER fulfill_order RPC calls nextval — no extra grant.
-- ===========================================================================
create sequence if not exists public.order_number_seq start with 10001;

-- ===========================================================================
-- 2. Additive orders columns (never drop; each guarded by if not exists)
-- ===========================================================================
alter table public.orders add column if not exists order_number text;
-- Unique index declared separately (not inline) so re-running the migration is idempotent.
create unique index if not exists orders_order_number_key
  on public.orders (order_number);
alter table public.orders add column if not exists notes text;                 -- optional PO / order notes (CONTEXT)
alter table public.orders add column if not exists tax_calculation_id text;     -- Stripe Tax calculation id (CHK-02)

-- ===========================================================================
-- 3. pending_orders staging table
--    Written at create-intent time (06-02), finalized/read by the webhook +
--    confirmation page (06-03). Keyed on the PaymentIntent id so it survives the
--    redirect race (RESEARCH Open Question 1 / Pitfall 5).
-- ===========================================================================
create table if not exists public.pending_orders (
  stripe_pi_id       text primary key,
  order_number       text not null,
  email              text not null,
  user_id            uuid references auth.users (id) on delete set null,
  ship_to_snapshot   jsonb not null,
  lines              jsonb not null,          -- [{variant_id, quantity, unit_price, sku, name}]
  subtotal           numeric(10,2) not null,
  shipping           numeric(10,2) not null,
  tax                numeric(10,2) not null default 0,
  total              numeric(10,2) not null,
  tax_calculation_id text,
  notes              text,
  status             text not null default 'pending',   -- pending | fulfilled
  created_at         timestamptz not null default now()
);

-- RLS — matches the exact public.orders pattern (enable + force; owner read by
-- user_id; admin override). pending_orders is written ONLY by service-role
-- (create-intent + webhook), which bypasses RLS, so users get NO insert/update
-- policy — read-own + admin only. Guests (user_id null) read their pending order
-- via the confirmation page's server route using service-role, not RLS, so no
-- anon policy is needed.
alter table public.pending_orders enable row level security;
alter table public.pending_orders force row level security;
create policy "pending_orders_select_own" on public.pending_orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "pending_orders_admin_all" on public.pending_orders
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
