-- ---------------------------------------------------------------------------
-- Truck-area tagging: browse the catalog by physical area of the truck.
--
-- Adds products.area (single primary-area tag, admin-editable later) with the
-- 8 confirmed areas: front, rear, side, cab, interior, wheels, engine,
-- trailer. Seeds the tag from the real category tree (L1-wide defaults +
-- L1/L2 pair refinements — Lighting splits across front/rear/side/etc.).
--
-- Idempotent + admin-safe: every UPDATE only touches rows where area IS NULL,
-- so re-running never clobbers a manually corrected tag. Cross-cutting stock
-- (wire terminals, tools, apparel, motorcycle) deliberately stays NULL — it
-- is reachable by category/search but does not pollute area browsing.
--
-- Also extends search_products with p_area (drop + recreate: the signature
-- changes, and CREATE OR REPLACE with a new arg list would leave a stale
-- overload behind for PostgREST to trip on).
-- ---------------------------------------------------------------------------

alter table public.products add column if not exists area text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_area_check'
  ) then
    alter table public.products add constraint products_area_check
      check (
        area is null
        or area in ('front','rear','side','cab','interior','wheels','engine','trailer')
      );
  end if;
end $$;

create index if not exists products_area_idx on public.products (area);

-- --- Pair-specific mapping (L1 name + L2 name -> area) ----------------------
-- Applied before the L1-wide defaults; both guard on area IS NULL.

update public.products p
set area = m.area
from public.categories c2
join public.categories c1 on c1.id = c2.parent_id
join (
  values
    -- Lighting: split by where the light lives on the rig
    ('Lighting', 'Headlights',                'front'),
    ('Lighting', 'Fog Lights',                'front'),
    ('Lighting', 'Parking Lights',            'front'),
    ('Lighting', 'Turn Signal Lights',        'front'),
    ('Lighting', 'Light Bars',                'front'),
    ('Lighting', 'Auxiliary Lights',          'front'),
    ('Lighting', 'Spot Lights',               'front'),
    ('Lighting', 'Tail Lights',               'rear'),
    ('Lighting', 'Brake Lights',              'rear'),
    ('Lighting', 'Back-Up Lights',            'rear'),
    ('Lighting', 'Turn & Tail Lights',        'rear'),
    ('Lighting', 'License Lights',            'rear'),
    ('Lighting', 'Trailer Lighting',          'trailer'),
    ('Lighting', 'Cab Lights',                'cab'),
    ('Lighting', 'Dome & Map Lights',         'interior'),
    ('Lighting', 'Clearance & Marker Lights', 'side'),
    ('Lighting', 'Side Marker Lights',        'side'),
    ('Lighting', 'Honda & Pedestal Lights',   'side'),
    ('Lighting', 'Fenders',                   'side'),
    ('Lighting', 'Door Lights',               'side'),
    -- Exterior: front end
    ('Exterior', 'Bumpers',                   'front'),
    ('Exterior', 'Bumper Guides',             'front'),
    ('Exterior', 'Grilles',                   'front'),
    ('Exterior', 'Grille Guards',             'front'),
    ('Exterior', 'Hood Accessories',          'front'),
    ('Exterior', 'Bug Deflectors',            'front'),
    ('Exterior', 'Windshields',               'front'),
    -- Exterior: rear end
    ('Exterior', 'Rear Light Bars',           'rear'),
    ('Exterior', 'Rear Center Light Panels',  'rear'),
    ('Exterior', 'Mud Flap Hangers & Accessories', 'rear'),
    ('Exterior', 'Towing & Cargo',            'rear'),
    ('Exterior', 'License Plate Accessories', 'rear'),
    -- Exterior: flanks
    ('Exterior', 'Mirrors',                   'side'),
    ('Exterior', 'Fenders',                   'side'),
    ('Exterior', 'Doors',                     'side'),
    ('Exterior', 'Window Accessories',        'side'),
    ('Exterior', 'Tool Boxes & Steps',        'side'),
    ('Exterior', 'Fairings',                  'side'),
    ('Exterior', 'Fuel Tanks Accessories',    'side'),
    ('Exterior', 'Accents',                   'side'),
    ('Exterior', 'Trims',                     'side'),
    -- Exterior: cab & roof
    ('Exterior', 'Sun Visors',                'cab'),
    ('Exterior', 'Sleeper Accessories',       'cab'),
    ('Exterior', 'Antennas & Accessories',    'cab'),
    ('Exterior', 'Horns',                     'cab'),
    -- Exterior: engine intake
    ('Exterior', 'Air Cleaners',              'engine'),
    -- Electrical / Tools / Accessories: the trailer + located bits
    ('Electrical', 'Trailer Connectors & Harness', 'trailer'),
    ('Tools',      'Gladhands',               'trailer'),
    ('Tools',      'Kingpin Locks',           'trailer'),
    ('Accessories','License Plate Accessories','rear'),
    ('Accessories','Door Accessories',        'side'),
    ('Accessories','Mirror Accessories',      'side')
) as m(l1, l2, area) on m.l1 = c1.name and m.l2 = c2.name
where p.category_id = c2.id
  and p.area is null;

-- --- L1-wide defaults --------------------------------------------------------

update public.products p
set area = m.area
from public.categories c2
join public.categories c1 on c1.id = c2.parent_id
join (
  values
    ('Interior',             'interior'),
    ('Wheels & Accessories', 'wheels'),
    ('Engine',               'engine'),
    ('Exhaust',              'engine')
) as m(l1, area) on m.l1 = c1.name
where p.category_id = c2.id
  and p.area is null;

-- --- search_products: add p_area ---------------------------------------------

drop function if exists public.search_products(text, bigint, bigint, numeric, numeric, text, int, int);

create function public.search_products(
  p_query        text     default null,
  p_category_id  bigint   default null,
  p_truck_model  bigint   default null,
  p_price_min    numeric  default null,
  p_price_max    numeric  default null,
  p_sort         text     default 'relevance',
  p_limit        int      default 24,
  p_offset       int      default 0,
  p_area         text     default null
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
    and (p_area is null or p.area = p_area)
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

grant execute on function public.search_products(text, bigint, bigint, numeric, numeric, text, int, int, text)
  to anon, authenticated;
