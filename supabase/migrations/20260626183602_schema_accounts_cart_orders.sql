-- Accounts, cart, and orders schema
-- Phase 01 Foundation, Plan 02, Task 2.
-- NOTE: No RLS / grants here on purpose — RLS lands in Plan 03.

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users (uuid PK = auth user id).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- addresses: saved shipping addresses per user.
-- ---------------------------------------------------------------------------
create table public.addresses (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  line1        text not null,
  line2        text,
  city         text not null,
  region       text,
  postal_code  text not null,
  country      text not null default 'US',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_user_id_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- carts: per-user only (unique user_id, NOT NULL). No anonymous-token rows;
-- guest carts live client-side until login (CONTEXT).
-- ---------------------------------------------------------------------------
create table public.carts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index carts_user_id_idx on public.carts (user_id);

-- ---------------------------------------------------------------------------
-- cart_items: one row per (cart, variant).
-- ---------------------------------------------------------------------------
create table public.cart_items (
  id          bigint generated always as identity primary key,
  cart_id     bigint not null references public.carts (id) on delete cascade,
  variant_id  bigint not null references public.product_variants (id) on delete cascade,
  quantity    integer not null default 1,
  created_at  timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index cart_items_cart_id_idx on public.cart_items (cart_id);
create index cart_items_variant_id_idx on public.cart_items (variant_id);

-- ---------------------------------------------------------------------------
-- orders: user_id NULLABLE (post-pay guest flow, ACCT-03). Immutable
-- ship_to_snapshot jsonb PLUS a nullable address_id FK.
-- ---------------------------------------------------------------------------
create table public.orders (
  id                bigint generated always as identity primary key,
  user_id           uuid references auth.users (id) on delete set null,
  status            text not null default 'pending',
  subtotal          numeric(10,2) not null default 0,
  shipping          numeric(10,2) not null default 0,
  tax               numeric(10,2) not null default 0,
  total             numeric(10,2) not null default 0,
  ship_to_snapshot  jsonb,
  address_id        bigint references public.addresses (id) on delete set null,
  stripe_pi_id      text unique,
  created_at        timestamptz not null default now()
);
create index orders_user_id_idx on public.orders (user_id);
create index orders_address_id_idx on public.orders (address_id);

-- ---------------------------------------------------------------------------
-- order_items: snapshot sku/name/unit_price so historical lines never change.
-- ---------------------------------------------------------------------------
create table public.order_items (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references public.orders (id) on delete cascade,
  variant_id    bigint references public.product_variants (id) on delete set null,
  sku_snapshot  text not null,
  name_snapshot text not null,
  unit_price    numeric(10,2) not null,
  quantity      integer not null default 1
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_variant_id_idx on public.order_items (variant_id);
