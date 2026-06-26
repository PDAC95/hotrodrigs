-- Admin RBAC: user_roles table, custom access token hook, is_admin() helper.
-- Phase 01 Foundation, Plan 03, Task 1.
-- Locked model (CONTEXT): admin authorization is a Postgres role injected as a
-- JWT claim by a Custom Access Token Hook. NO is_admin boolean, NO user_metadata.
-- The hook is enabled in supabase/config.toml ([auth.hook.custom_access_token]);
-- the stack must be restarted after enabling it (the hook only fires post-restart).

-- app_role enum. Single role for now; extend in place if more roles are needed.
create type public.app_role as enum ('admin');

-- user_roles: which auth user holds which role. RLS enabled + forced with NO
-- anon/authenticated policy => only service_role and supabase_auth_admin can read.
create table public.user_roles (
  id      bigint generated always as identity primary key,
  user_id uuid references auth.users on delete cascade not null,
  role    app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

-- Custom Access Token Hook: at token issuance, inject claims.user_role from the
-- user's row in user_roles. Runs as supabase_auth_admin.
-- search_path is pinned to '' (all refs schema-qualified) so a malicious
-- search_path cannot shadow object references (advisor: search_path mutable).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable
set search_path = ''
as $$
declare
  claims    jsonb;
  user_role public.app_role;
begin
  select role into user_role
  from public.user_roles
  where user_id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{user_role}', coalesce(to_jsonb(user_role), 'null'));
  event  := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- supabase_auth_admin runs the hook and must read user_roles inside it.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on table public.user_roles to supabase_auth_admin;

-- is_admin(): reads the user_role JWT claim — no per-request table read.
-- Used by every admin-write RLS policy in the rls_policies migration.
create or replace function public.is_admin()
returns boolean language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'user_role') = 'admin', false);
$$;
