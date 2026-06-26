-- Seed for the local stack — Phase 01 Foundation, Plan 04.
-- Runs after migrations on every `supabase db reset` ([db.seed] sql_paths = ["./seed.sql"]).
--
-- Creates two confirmed test users (each owning a cart + an order) plus exactly
-- one bootstrap admin in public.user_roles. These rows are the fixtures the
-- cross-user RLS isolation test (scripts/rls-isolation-test.mjs) signs in as.
--
-- Test credentials (mirrored as constants in the isolation test):
--   user-a@test.local / test-password-a   (bootstrap admin)
--   user-b@test.local / test-password-b
--
-- Idempotent: deletes its own seeded rows first so it survives reruns. A full
-- `supabase db reset` already starts from an empty schema, but the guards keep
-- re-running seed.sql against a warm db safe.

-- ---------------------------------------------------------------------------
-- 0. Clean any prior seed rows (idempotency). auth.users cascades to the
--    public tables via on delete cascade / set null.
-- ---------------------------------------------------------------------------
delete from auth.users where email in ('user-a@test.local', 'user-b@test.local');
delete from public.products where slug = 'seed-test-part';

-- ---------------------------------------------------------------------------
-- 1. Two confirmed auth users with known passwords.
--    email_confirmed_at is set so signInWithPassword works (confirmations off
--    locally, but a confirmed timestamp is still required to sign in).
--    A matching auth.identities row is required for password sign-in to resolve
--    the user by email.
-- ---------------------------------------------------------------------------
with seeded_users as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    -- GoTrue scans these token columns as non-nullable strings; NULL trips a
    -- "converting NULL to string is unsupported" 500 on sign-in. Seed '' .
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token
  )
  values
    (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'user-a@test.local',
      crypt('test-password-a', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      false,
      '', '', '', '', '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'user-b@test.local',
      crypt('test-password-b', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      false,
      '', '', '', '', '', '', '', ''
    )
  returning id, email
)
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(),
  now(),
  now()
from seeded_users u;

-- ---------------------------------------------------------------------------
-- 2. A minimal catalog row so cart_items / order_items can reference a real
--    variant (no other catalog rows are seeded at this phase).
-- ---------------------------------------------------------------------------
with p as (
  insert into public.products (name, slug, description, oem_number)
  values ('Seed Test Part', 'seed-test-part', 'Fixture product for RLS isolation seed', 'SEED-OEM-1')
  returning id
)
insert into public.product_variants (product_id, sku, price, stock)
select id, 'SEED-SKU-1', 19.99, 100 from p;

-- ---------------------------------------------------------------------------
-- 3. Per-user owned rows: one cart + one order each, with line items pointing
--    at the seeded variant. These are what cross-user reads must fail to see.
-- ---------------------------------------------------------------------------
do $$
declare
  v_user_a   uuid := (select id from auth.users where email = 'user-a@test.local');
  v_user_b   uuid := (select id from auth.users where email = 'user-b@test.local');
  v_variant  bigint := (select id from public.product_variants where sku = 'SEED-SKU-1');
  v_cart_a   bigint;
  v_cart_b   bigint;
  v_order_a  bigint;
  v_order_b  bigint;
begin
  -- Carts (one per user).
  insert into public.carts (user_id) values (v_user_a) returning id into v_cart_a;
  insert into public.carts (user_id) values (v_user_b) returning id into v_cart_b;

  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart_a, v_variant, 2);
  insert into public.cart_items (cart_id, variant_id, quantity) values (v_cart_b, v_variant, 1);

  -- Orders (one per user) with an immutable ship_to_snapshot and totals.
  insert into public.orders (user_id, status, subtotal, shipping, tax, total, ship_to_snapshot)
  values (
    v_user_a, 'paid', 39.98, 9.99, 3.30, 53.27,
    jsonb_build_object('name','User A','line1','1 A St','city','Austin','region','TX','postal_code','78701','country','US')
  )
  returning id into v_order_a;

  insert into public.orders (user_id, status, subtotal, shipping, tax, total, ship_to_snapshot)
  values (
    v_user_b, 'paid', 19.99, 9.99, 1.65, 31.63,
    jsonb_build_object('name','User B','line1','2 B St','city','Dallas','region','TX','postal_code','75201','country','US')
  )
  returning id into v_order_b;

  insert into public.order_items (order_id, variant_id, sku_snapshot, name_snapshot, unit_price, quantity)
  values (v_order_a, v_variant, 'SEED-SKU-1', 'Seed Test Part', 19.99, 2);

  insert into public.order_items (order_id, variant_id, sku_snapshot, name_snapshot, unit_price, quantity)
  values (v_order_b, v_variant, 'SEED-SKU-1', 'Seed Test Part', 19.99, 1);

  -- ------------------------------------------------------------------------
  -- 4. Exactly ONE bootstrap admin: user-a holds the 'admin' role.
  --    NOTE: this admin must refresh their session once for the user_role JWT
  --    claim to appear (the Custom Access Token Hook fires at token issuance;
  --    Plan 03 / Pitfall 5).
  -- ------------------------------------------------------------------------
  insert into public.user_roles (user_id, role) values (v_user_a, 'admin');
end $$;
