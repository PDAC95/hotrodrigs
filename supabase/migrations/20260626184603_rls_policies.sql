-- RLS policies for catalog (public-read + admin-write) and user-owned tables.
-- Phase 01 Foundation, Plan 03, Task 2.
-- Rules: enable + force RLS on every table; wrap auth in (select ...) for perf;
-- TO authenticated/anon role targeting (not auth.role()); UPDATE carries BOTH
-- using and with check; admin writes go through (select public.is_admin()).

-- ===========================================================================
-- CATALOG: public-read (anon + authenticated), admin-write.
-- ===========================================================================

-- products -------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.products force row level security;
create policy "products_public_read" on public.products
  for select to anon, authenticated using (true);
create policy "products_admin_write" on public.products
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- product_variants -----------------------------------------------------------
alter table public.product_variants enable row level security;
alter table public.product_variants force row level security;
create policy "product_variants_public_read" on public.product_variants
  for select to anon, authenticated using (true);
create policy "product_variants_admin_write" on public.product_variants
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- product_images -------------------------------------------------------------
alter table public.product_images enable row level security;
alter table public.product_images force row level security;
create policy "product_images_public_read" on public.product_images
  for select to anon, authenticated using (true);
create policy "product_images_admin_write" on public.product_images
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- categories -----------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.categories force row level security;
create policy "categories_public_read" on public.categories
  for select to anon, authenticated using (true);
create policy "categories_admin_write" on public.categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- truck_makes ----------------------------------------------------------------
alter table public.truck_makes enable row level security;
alter table public.truck_makes force row level security;
create policy "truck_makes_public_read" on public.truck_makes
  for select to anon, authenticated using (true);
create policy "truck_makes_admin_write" on public.truck_makes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- truck_models ---------------------------------------------------------------
alter table public.truck_models enable row level security;
alter table public.truck_models force row level security;
create policy "truck_models_public_read" on public.truck_models
  for select to anon, authenticated using (true);
create policy "truck_models_admin_write" on public.truck_models
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- product_truck_compat -------------------------------------------------------
alter table public.product_truck_compat enable row level security;
alter table public.product_truck_compat force row level security;
create policy "product_truck_compat_public_read" on public.product_truck_compat
  for select to anon, authenticated using (true);
create policy "product_truck_compat_admin_write" on public.product_truck_compat
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ===========================================================================
-- USER-OWNED: owner-scoped via (select auth.uid()). Admin override where admins
-- must manage user data (Phase 7 fulfillment).
-- ===========================================================================

-- profiles: ownership predicate is id (PK = auth user id). -------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- addresses: owner-scoped via user_id; deletes allowed. ----------------------
alter table public.addresses enable row level security;
alter table public.addresses force row level security;
create policy "addresses_select_own" on public.addresses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "addresses_insert_own" on public.addresses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "addresses_update_own" on public.addresses
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "addresses_delete_own" on public.addresses
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "addresses_admin_all" on public.addresses
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- carts: owner-scoped via user_id (one per user). ----------------------------
alter table public.carts enable row level security;
alter table public.carts force row level security;
create policy "carts_select_own" on public.carts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "carts_insert_own" on public.carts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "carts_update_own" on public.carts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "carts_delete_own" on public.carts
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "carts_admin_all" on public.carts
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- cart_items: no direct user_id — scoped via parent cart ownership. ----------
alter table public.cart_items enable row level security;
alter table public.cart_items force row level security;
create policy "cart_items_select_own" on public.cart_items
  for select to authenticated using (
    cart_id in (select id from public.carts where user_id = (select auth.uid()))
  );
create policy "cart_items_insert_own" on public.cart_items
  for insert to authenticated with check (
    cart_id in (select id from public.carts where user_id = (select auth.uid()))
  );
create policy "cart_items_update_own" on public.cart_items
  for update to authenticated
  using (
    cart_id in (select id from public.carts where user_id = (select auth.uid()))
  )
  with check (
    cart_id in (select id from public.carts where user_id = (select auth.uid()))
  );
create policy "cart_items_delete_own" on public.cart_items
  for delete to authenticated using (
    cart_id in (select id from public.carts where user_id = (select auth.uid()))
  );
create policy "cart_items_admin_all" on public.cart_items
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders: READ-ONLY for the user (orders are created server-side by the Phase 6
-- webhook via the service-role client, which bypasses RLS). No user INSERT/UPDATE.
alter table public.orders enable row level security;
alter table public.orders force row level security;
create policy "orders_select_own" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- order_items: no direct user_id — scoped via parent order ownership.
-- READ-ONLY for the user (created server-side alongside the order). ----------
alter table public.order_items enable row level security;
alter table public.order_items force row level security;
create policy "order_items_select_own" on public.order_items
  for select to authenticated using (
    order_id in (select id from public.orders where user_id = (select auth.uid()))
  );
create policy "order_items_admin_all" on public.order_items
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ===========================================================================
-- GRANTS: RLS controls rows, grants control table access (Pitfall 7).
-- Catalog tables must be reachable by anon/authenticated; the Data API role set
-- already has table-level grants from the default Supabase config, but make the
-- public-read intent explicit. Writes are still gated by the admin policies.
-- ===========================================================================
grant select on public.products, public.product_variants, public.product_images,
  public.categories, public.truck_makes, public.truck_models,
  public.product_truck_compat to anon, authenticated;
