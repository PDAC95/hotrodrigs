-- Additive ETL-support columns + idempotency indexes.
-- Phase 02 Catalog Import & Data Modeling, Plan 01, Task 2.
--
-- PURELY ADDITIVE: only `add column if not exists` and `create unique index`.
-- No Phase 1 table is dropped/recreated. No RLS/grants here — the new columns
-- inherit the table-level policies already applied in Phase 1 Plan 03.
--
-- Why these exist: the Phase 1 catalog schema predates the ETL design, so it
-- lacks a natural upsert key, a quarantine flag, freight metadata, and the
-- unique constraints that make the ETL safe to re-run.

-- ---------------------------------------------------------------------------
-- product_variants: upsert key + quarantine flag + freight metadata.
-- ---------------------------------------------------------------------------
alter table public.product_variants
  add column if not exists item_no     text,
  add column if not exists published   boolean not null default true,
  add column if not exists ship_type   text,
  add column if not exists oversized   boolean not null default false,
  add column if not exists description text;

-- Natural join/upsert key from the source "Item No." column.
-- This is what `upsert(..., { onConflict: 'item_no' })` conflicts on.
-- item_no is set for every loaded row; the unique index keeps re-runs idempotent.
create unique index if not exists product_variants_item_no_key
  on public.product_variants (item_no);

-- ---------------------------------------------------------------------------
-- products: fitment normalization columns.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists fits_all     boolean not null default false,
  add column if not exists raw_fitment  text;

-- ---------------------------------------------------------------------------
-- product_images: durable idempotency guard so re-runs don't duplicate images.
-- ---------------------------------------------------------------------------
create unique index if not exists product_images_product_url_key
  on public.product_images (product_id, url);
