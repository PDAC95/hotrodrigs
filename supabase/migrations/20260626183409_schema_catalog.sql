-- Catalog + fitment schema
-- Phase 01 Foundation, Plan 02, Task 1.
-- NOTE: No RLS / grants here on purpose — RLS lands in Plan 03.

-- ---------------------------------------------------------------------------
-- categories: self-referencing L1 (section) -> L2 (subcategory) hierarchy.
-- ---------------------------------------------------------------------------
create table public.categories (
  id          bigint generated always as identity primary key,
  parent_id   bigint references public.categories (id) on delete set null,
  name        text not null,
  slug        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index categories_parent_id_idx on public.categories (parent_id);

-- ---------------------------------------------------------------------------
-- products: the parent record. Variants hang off it.
-- ---------------------------------------------------------------------------
create table public.products (
  id              bigint generated always as identity primary key,
  category_id     bigint references public.categories (id) on delete set null,
  name            text not null,
  slug            text not null unique,
  description     text,
  oem_number      text,
  prop65_warning  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);

-- ---------------------------------------------------------------------------
-- product_variants: every variant has a NOT NULL parent (parent/variant integrity).
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products (id) on delete cascade,
  sku         text not null unique,
  size        text,
  pack        text,
  price       numeric(10,2) not null default 0,
  stock       integer not null default 0,
  weight      numeric(10,2),
  length      numeric(10,2),
  width       numeric(10,2),
  height      numeric(10,2),
  ltl_flag    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index product_variants_product_id_idx on public.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table public.product_images (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products (id) on delete cascade,
  url         text not null,
  alt         text,
  sort_order  integer not null default 0
);
create index product_images_product_id_idx on public.product_images (product_id);

-- ---------------------------------------------------------------------------
-- Fitment: truck_makes -> truck_models -> product_truck_compat (join).
-- ---------------------------------------------------------------------------
create table public.truck_makes (
  id    bigint generated always as identity primary key,
  name  text not null unique
);

create table public.truck_models (
  id       bigint generated always as identity primary key,
  make_id  bigint not null references public.truck_makes (id) on delete cascade,
  name     text not null,
  unique (make_id, name)
);
create index truck_models_make_id_idx on public.truck_models (make_id);

create table public.product_truck_compat (
  id              bigint generated always as identity primary key,
  product_id      bigint not null references public.products (id) on delete cascade,
  truck_model_id  bigint not null references public.truck_models (id) on delete cascade,
  unique (product_id, truck_model_id)
);
create index product_truck_compat_product_id_idx on public.product_truck_compat (product_id);
create index product_truck_compat_truck_model_id_idx on public.product_truck_compat (truck_model_id);
