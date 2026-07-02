-- Fix: the custom_access_token_hook injected user_role = null for the admin, so
-- the /admin gate (Phase 08) redirected even user-a. Root cause: public.user_roles
-- has RLS FORCEd with NO policy. The 20260626184224 migration assumed a table
-- `grant select ... to supabase_auth_admin` was enough, but under FORCE RLS a role
-- still needs a matching POLICY to see any row — only service_role BYPASSes RLS,
-- supabase_auth_admin does NOT. The hook runs as supabase_auth_admin (SECURITY
-- INVOKER), so its `select role from public.user_roles` returned zero rows and the
-- JWT claim came back null. This is the official Supabase RBAC pattern: a permissive
-- SELECT policy scoped to supabase_auth_admin so the token hook can read the role.
-- Additive + idempotent; grants already exist from 20260626184224.

drop policy if exists "auth_admin_read_user_roles" on public.user_roles;
create policy "auth_admin_read_user_roles"
on public.user_roles
as permissive
for select
to supabase_auth_admin
using (true);
