-- Phase 13 Stock Semantics Fix, Plan 01 — additive migration (STOCK-01 + DB half of STOCK-02).
-- Purely additive: NO drop, NO destructive alter, NEVER edit prior migrations,
-- NEVER `db reset` (the 10K catalog lives only in the DB, loaded via ETL).
--
-- The stock model from this migration on:
--   * stock NULL = UNTRACKED (orderable, order-from-supplier — the catalog-wide default)
--   * numeric    = TRACKED (admin-owned; capped + atomically decremented by fulfill_order)
--
-- Provides:
--   1. Nullable product_variants.stock + one-time catalog-wide sweep to NULL
--   2. orders.stock_issue marker (webhook-race loser gets FLAGGED, never refunded automatically)
--   3. products.in_stock recompute with the new orderability predicate
--   4. Replaced fulfill_order: tracked-only clamp-and-flag decrement — NEVER raises insufficient_stock

-- ===========================================================================
-- 1. Guarded nullable + sweep.
--    Run-once sentinel = the NOT NULL constraint itself: the sweep only fires
--    when the column is still NOT NULL (i.e., the first application). Re-runs
--    find the column already nullable and skip the sweep, so admin stock edits
--    made after the first run are never clobbered.
-- ===========================================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_variants'
      and column_name = 'stock' and is_nullable = 'NO'
  ) then
    -- First run only: relax the column, then sweep the WHOLE catalog untracked.
    -- (CONTEXT: no admin-edited stock exists; ETL zeros + Phase-4 demo 25s are fiction.)
    alter table public.product_variants alter column stock drop not null;
    alter table public.product_variants alter column stock set default null;
    update public.product_variants set stock = null;
  end if;
  -- Re-run: column already nullable -> sweep skipped -> post-migration admin edits preserved.
end $$;

-- ===========================================================================
-- 2. orders.stock_issue marker (additive).
--    Set by fulfill_order when a tracked line comes up short: the order is
--    flagged for MANUAL resolution (operator decides refund vs fulfill-from-
--    supplier). Locked decision: no automatic refunds.
-- ===========================================================================
alter table public.orders add column if not exists stock_issue boolean not null default false;

-- ===========================================================================
-- 3. in_stock recompute with the NEW orderability predicate
--    (untracked NULL counts as orderable). Safe to re-run any time; runs AFTER
--    the sweep so the whole catalog flips orderable on first application.
-- ===========================================================================
update public.products p
set in_stock = exists (
  select 1 from public.product_variants v
  where v.product_id = p.id
    and v.published = true
    and (v.stock is null or v.stock > 0)
);

-- ===========================================================================
-- 4. Replace fulfill_order — clamp-and-flag (STOCK-02, the ONLY money-path
--    change in v1.3). Identical 11-arg signature to 20260701120000_checkout.sql.
--    Untracked lines (stock NULL) skip the decrement entirely; a tracked
--    shortage clamps stock at 0 and flags orders.stock_issue. NEVER raises —
--    a raise rolls back the whole tx, leaving a paid buyer with no order row
--    and a confirmation page that polls forever.
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
  v_order_id    bigint;
  v_line        jsonb;
  v_stock       integer;
  v_stock_issue boolean := false;
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
    -- Lock the variant row. NULL stock = untracked -> no decrement, no cap (STOCK-02).
    select stock into v_stock
      from public.product_variants
     where id = (v_line->>'variant_id')::bigint
       for update;

    if v_stock is not null then
      -- Tracked: clamp at 0. A shortage FLAGS the order for manual resolution
      -- (locked decision: no automatic refunds; operator decides refund vs
      -- fulfill-from-supplier). NEVER raise — a raise rolls back the whole tx,
      -- leaving a paid buyer with no order row and a confirmation page that
      -- polls forever.
      if v_stock < (v_line->>'quantity')::int then
        v_stock_issue := true;
      end if;
      update public.product_variants
         set stock = greatest(v_stock - (v_line->>'quantity')::int, 0)
       where id = (v_line->>'variant_id')::bigint;
    end if;

    insert into public.order_items (order_id, variant_id, sku_snapshot, name_snapshot, unit_price, quantity)
    values (v_order_id, (v_line->>'variant_id')::bigint, v_line->>'sku', v_line->>'name',
            (v_line->>'unit_price')::numeric, (v_line->>'quantity')::int);
  end loop;

  if v_stock_issue then
    update public.orders set stock_issue = true where id = v_order_id;
  end if;

  -- Mark the staging row fulfilled so the confirmation page can stop polling.
  update public.pending_orders set status = 'fulfilled' where stripe_pi_id = p_stripe_pi_id;

  return v_order_id;
end;
$$;

-- Only the service-role (webhook) may call fulfill_order; never anon/authenticated.
-- (Re-stated from 20260701120000_checkout.sql — idempotent, keeps intent explicit.)
revoke all on function public.fulfill_order(text,text,uuid,jsonb,numeric,numeric,numeric,numeric,text,text,jsonb) from public;
grant execute on function public.fulfill_order(text,text,uuid,jsonb,numeric,numeric,numeric,numeric,text,text,jsonb) to service_role;
