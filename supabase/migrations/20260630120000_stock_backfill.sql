-- Stock backfill so the cart is verifiable on real products.
-- Phase 04 Accounts & Cart, Plan 02, Task 1.
--
-- Phase 3 left every ETL-loaded variant at stock = 0 (the source catalog had
-- in_stock = false catalog-wide), which makes add-to-cart and the live
-- quantity cap impossible to demonstrate on real data. This migration sets a
-- plausible non-zero stock on a BOUNDED subset of published, priced variants.
--
-- Discipline (mirrors Phase 3's live-migration approach):
--   * NON-DESTRUCTIVE  — only writes the `stock` column; touches no other data.
--   * IDEMPOTENT        — re-running yields the same state (always sets 25 on the
--                         same deterministic, id-ordered subset).
--   * Apply LIVE with `supabase migration up` (NEVER `db reset`: a reset wipes
--     the 10K ETL-loaded catalog, which lives only in the DB, not in seed.sql).
--
-- Real stock arrives in a later catalog refresh / admin tooling (Phase 7).
-- `published` lives on public.products (added by the ETL columns migration).

update public.product_variants v
set stock = 25
from public.products p
where v.product_id = p.id
  and p.published = true
  and v.price is not null
  and v.id in (
    select v2.id
    from public.product_variants v2
    join public.products p2 on p2.id = v2.product_id
    where p2.published = true
      and v2.price is not null
    order by v2.id
    limit 200
  );
