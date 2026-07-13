-- ---------------------------------------------------------------------------
-- Search category filter: expand L1 (parent) categories to their children.
--
-- Products hang off L2 (leaf) categories, but both the header search select
-- and the /search FilterSidebar offer L1 categories as filters. The previous
-- predicate `p.category_id = p_category_id` therefore returned 0 results for
-- every L1 id. Fix: also match products whose category's parent is the given
-- id (the tree is exactly two levels, so one parent_id hop covers it).
-- Non-destructive: create-or-replace only, body otherwise identical to
-- 20260629120000_search_word_similarity.sql.
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
  where (
      p_category_id is null
      or p.category_id = p_category_id
      or p.category_id in (
        select c.id from public.categories c where c.parent_id = p_category_id
      )
    )
    and (
      p_query is null
      or p.search_doc @@ websearch_to_tsquery('english', p_query)
      or extensions.word_similarity(p_query, p.name) > 0.3
      or extensions.word_similarity(p_query, coalesce(p.oem_number, '')) > 0.3
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
