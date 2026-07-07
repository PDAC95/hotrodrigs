-- sent_emails: idempotency claim table for transactional emails (EML-04).
-- Additive + idempotent. The UNIQUE(order_number, email_type) constraint is the
-- DB-level arbiter for duplicate sends: sendOnce() upserts with
-- ignoreDuplicates and treats 0 returned rows as "already claimed".
-- RLS discipline mirrors pending_orders: enable + force, NO user policies —
-- only service-role (bypasses RLS) reads/writes this table.

create table if not exists public.sent_emails (
  id bigint generated always as identity primary key,
  order_number text not null,
  email_type text not null check (email_type in ('order_confirmation','guest_activation','order_fulfilled')),
  recipient text,
  resend_id text,
  created_at timestamptz not null default now(),
  unique (order_number, email_type)
);
alter table public.sent_emails enable row level security;
alter table public.sent_emails force row level security;
-- No policies on purpose: only service-role (bypasses RLS) reads/writes this table.
