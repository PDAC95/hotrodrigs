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

-- ===========================================================================
-- 4. fulfill_order RPC (RESEARCH Pattern 4) — the single transactional
--    fulfillment path the webhook (06-03) calls.
--    SECURITY DEFINER + set search_path = '' + fully-qualified objects
--    (matches the Phase 1 03-01 RBAC-hook convention).
-- ===========================================================================
create or replace function public.fulfill_order(
  p_stripe_pi_id       text,
  p_order_number       text,
  p_user_id            uuid,
  p_ship_to            jsonb,
  p_subtotal           numeric,
  p_shipping           numeric,
  p_tax                numeric,
  p_total              numeric,
  p_tax_calculation_id text,
  p_notes              text,
  p_lines              jsonb   -- [{variant_id, quantity, unit_price, sku, name}]
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id bigint;
  v_line     jsonb;
  v_updated  integer;
begin
  -- Idempotent: a replayed PI hits the UNIQUE stripe_pi_id and returns the existing order.
  insert into public.orders (stripe_pi_id, status, user_id, ship_to_snapshot,
                             subtotal, shipping, tax, total, order_number, tax_calculation_id, notes)
  values (p_stripe_pi_id, 'paid', p_user_id, p_ship_to,
          p_subtotal, p_shipping, p_tax, p_total, p_order_number, p_tax_calculation_id, p_notes)
  on conflict (stripe_pi_id) do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select id into v_order_id from public.orders where stripe_pi_id = p_stripe_pi_id;
    -- Already fulfilled by a prior delivery of this event; do NOT re-decrement stock.
    return v_order_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    -- Atomic conditional decrement (CHK-05). Row is locked for the UPDATE; two
    -- concurrent last-unit buys cannot both succeed.
    update public.product_variants
       set stock = stock - (v_line->>'quantity')::int
     where id = (v_line->>'variant_id')::bigint
       and stock >= (v_line->>'quantity')::int;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      -- Genuine oversell: raise so the whole transaction rolls back. The webhook
      -- (06-03) catches insufficient_stock and refunds rather than looping
      -- (RESEARCH Pitfall 4) — the RPC's job is only to guarantee atomicity.
      raise exception 'insufficient_stock for variant %', v_line->>'variant_id';
    end if;

    insert into public.order_items (order_id, variant_id, sku_snapshot, name_snapshot, unit_price, quantity)
    values (v_order_id, (v_line->>'variant_id')::bigint, v_line->>'sku', v_line->>'name',
            (v_line->>'unit_price')::numeric, (v_line->>'quantity')::int);
  end loop;

  -- Mark the staging row fulfilled so the confirmation page can stop polling.
  update public.pending_orders set status = 'fulfilled' where stripe_pi_id = p_stripe_pi_id;

  return v_order_id;
end;
$$;

-- Only the service-role (webhook) may call fulfill_order; never anon/authenticated.
revoke all on function public.fulfill_order(text,text,uuid,jsonb,numeric,numeric,numeric,numeric,text,text,jsonb) from public;
grant execute on function public.fulfill_order(text,text,uuid,jsonb,numeric,numeric,numeric,numeric,text,text,jsonb) to service_role;
