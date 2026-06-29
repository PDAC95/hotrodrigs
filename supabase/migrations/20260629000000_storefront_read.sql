-- Storefront read-path: parent aggregates + FTS/trigram indexes + composite search RPC.
-- Phase 03 Storefront Read Path, Plan 01, Task 1.
--
-- PURELY ADDITIVE: only `create extension if not exists`, `add column if not exists`,
-- `create index if not exists`, `create or replace function`, and one-time idempotent
-- `update` backfills. No Phase 1/2 table is altered or dropped.
--
-- No RLS / grants on the new COLUMNS — they inherit the table-level policies already
-- applied in Phase 1 Plan 03 (catalog tables are public-read to anon+authenticated).
-- The search_products function is `security definer set search_path = ''` (pinned,
-- house convention) and is granted execute to anon + authenticated below.
--
-- Why these exist: the browse path lists PARENTS while price/stock/fitment live on
-- variants and the compat join. Aggregating per-card would be N+1 at ~10K parents
-- (BRWS-06). We denormalize a few parent-level aggregates and push all filtering /
-- ranking into indexed Postgres via one composite RPC, so downstream plans never
-- write inline queries and never fetch the full catalog.

-- ---------------------------------------------------------------------------
-- 0. Extensions. Pinned to the `extensions` schema (Supabase default, already on
--    the request search_path). The search_products function pins search_path='',
--    so its trigram operator is schema-qualified as OPERATOR(extensions.%) below.
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Denormalized parent-level aggregate columns on public.products.
--    NULL-safe; computed over PUBLISHED variants only (product_variants.published).
--    These kill Pitfall 1 (per-card N+1 for price/stock/image).
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists price_min       numeric(10,2),
  add column if not exists price_max       numeric(10,2),
  add column if not exists in_stock        boolean not null default false,
  add column if not exists cover_image_url text,
  add column if not exists featured        boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Weighted FTS: stored generated tsvector. name + OEM weight A, description B.
--    websearch_to_tsquery('english', ...) ranks against this at query time.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(oem_number, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists products_search_doc_idx
  on public.products using gin (search_doc);

-- ---------------------------------------------------------------------------
-- 3. Trigram GIN indexes for typo tolerance + partial OEM matching
--    (the `name % q` / `oem_number % q` similarity fallback in the RPC).
-- ---------------------------------------------------------------------------
create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);
create index if not exists products_oem_trgm_idx
  on public.products using gin (oem_number gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 4. Supporting btree indexes for fast PLP listing + sort.
--    (FK indexes from Phase 1 already cover category_id alone; these cover the
--     "featured first within a category" and price-sort access paths.)
-- ---------------------------------------------------------------------------
create index if not exists products_category_featured_id_idx
  on public.products (category_id, featured desc, id);
create index if not exists products_price_min_idx
  on public.products (price_min);

-- ---------------------------------------------------------------------------
-- 5. One-time idempotent backfills (safe to re-run; recompute from current data).
-- ---------------------------------------------------------------------------

-- 5a. price_min / price_max over PUBLISHED variants. NULL when no published variant.
update public.products p
set price_min = agg.min_price,
    price_max = agg.max_price
from (
  select product_id,
         min(price) as min_price,
         max(price) as max_price
  from public.product_variants
  where published = true
  group by product_id
) agg
where agg.product_id = p.id;

-- Parents with no published variant get NULL price (left untouched above); make it
-- explicit so a re-run after a variant is unpublished clears a stale range.
update public.products p
set price_min = null,
    price_max = null
where not exists (
  select 1 from public.product_variants v
  where v.product_id = p.id and v.published = true
);

-- 5b. in_stock = a published variant with stock > 0 exists.
update public.products p
set in_stock = exists (
  select 1 from public.product_variants v
  where v.product_id = p.id and v.published = true and v.stock > 0
);

-- 5c. cover_image_url = url of the lowest sort_order image (tiebreak by id).
--     Left NULL when the product has no image row; the data layer applies the
--     /assets/images/placeholder-product.png fallback so cards never branch on it.
update public.products p
set cover_image_url = img.url
from (
  select distinct on (product_id) product_id, url
  from public.product_images
  order by product_id, sort_order, id
) img
where img.product_id = p.id;

-- 5d. featured: no best-seller marker survived the Phase 2 ETL onto products or
--     product_variants (only item_no/published/ship_type/oversized/description were
--     added to variants; fits_all/raw_fitment to products). So we leave featured =
--     false for all rows. The PLP "featured first" sort degrades gracefully to id
--     order. Backfilling the 413 best sellers from the source workbook is a
--     follow-up admin/ETL task (see SUMMARY). No re-read of the workbook here.
--     (No UPDATE needed — the column default is already false.)

-- ---------------------------------------------------------------------------
-- 6. Composite search RPC: category + text (FTS + trigram fallback) + fitment
--    (compat OR fits_all) + price overlap + sort + pagination, one row per parent,
--    with a window total for numbered pagination — all in one indexed round-trip.
-- ---------------------------------------------------------------------------
create or replace function public.search_products(
  p_query        text     default null,
  p_category_id  bigint   default null,
  p_truck_model  bigint   default null,
  p_price_min    numeric  default null,
  p_price_max    numeric  default null,
  p_sort         text     default 'relevance',
  p_limit        int      default 24,
  p_offset       int      default 0
)
returns table (
  id              bigint,
  name            text,
  slug            text,
  price_min       numeric,
  price_max       numeric,
  in_stock        boolean,
  cover_image_url text,
  fits_all        boolean,
  rank            real,
  total           bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.price_min,
    p.price_max,
    p.in_stock,
    p.cover_image_url,
    p.fits_all,
    case
      when p_query is null then 0
      else ts_rank(p.search_doc, websearch_to_tsquery('english', p_query))
    end as rank,
    count(*) over() as total
  from public.products p
  where (p_category_id is null or p.category_id = p_category_id)
    and (
      p_query is null
      or p.search_doc @@ websearch_to_tsquery('english', p_query)
      or p.name OPERATOR(extensions.%) p_query
      or p.oem_number OPERATOR(extensions.%) p_query
    )
    and (p_price_min is null or p.price_max >= p_price_min)
    and (p_price_max is null or p.price_min <= p_price_max)
    and (
      p_truck_model is null
      or p.fits_all
      or exists (
        select 1 from public.product_truck_compat c
        where c.product_id = p.id and c.truck_model_id = p_truck_model
      )
    )
  order by
    case
      when p_sort = 'relevance' then
        case
          when p_query is null then 0
          else ts_rank(p.search_doc, websearch_to_tsquery('english', p_query))
        end
    end desc nulls last,
    case when p_sort = 'price_asc'  then p.price_min end asc  nulls last,
    case when p_sort = 'price_desc' then p.price_min end desc nulls last,
    case when p_sort = 'name'       then p.name      end asc,
    p.featured desc,
    p.id
  limit p_limit offset p_offset;
$$;

grant execute on function public.search_products(text, bigint, bigint, numeric, numeric, text, int, int)
  to anon, authenticated;
