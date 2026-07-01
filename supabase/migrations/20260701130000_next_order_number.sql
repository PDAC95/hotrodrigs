-- Phase 06 Checkout & Payments, Plan 02 — next_order_number RPC.
-- Additive / idempotent (create or replace). NEVER `db reset` (the 10K catalog
-- lives only in the DB). Depends on public.order_number_seq from the 06-01
-- migration (20260701120000_checkout.sql).
--
-- Kept in its OWN migration (not appended to the 06-01 file) because 06-03 runs
-- in parallel in the same working tree and may be editing shared files — a new
-- additive migration avoids a shared-file write race while still coordinating on
-- the same sequence.
--
-- Provides for 06-02 create-intent: a race-safe, single-round-trip order-number
-- reservation. nextval is atomic so two concurrent intents never collide, and the
-- reserved number stays stable for the confirmation page.

create or replace function public.next_order_number()
returns text
language sql
security definer
set search_path = ''
as $$
  select '#HRR-' || nextval('public.order_number_seq')
$$;

-- Only the service-role (create-intent) may reserve a number; never anon/authenticated.
revoke all on function public.next_order_number() from public;
grant execute on function public.next_order_number() to service_role;
