-- ---------------------------------------------------------------------------
-- Deal of the Week — scheduled product highlights.
--
-- A deal points at one product for a real time window (starts_at..ends_at),
-- so the storefront countdown counts to a TRUE end date (brand rule: no fake
-- urgency). Display-only by design: no price override, the money path is
-- untouched. Admin will get a picker to schedule deals; multiple rows can be
-- queued (next week's deal scheduled in advance) — the storefront shows the
-- active one with the nearest end.
-- ---------------------------------------------------------------------------

create table public.deals (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references public.products (id) on delete cascade,
  headline    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint deals_window_check check (ends_at > starts_at)
);

create index deals_window_idx on public.deals (active, starts_at, ends_at);
create index deals_product_id_idx on public.deals (product_id);

alter table public.deals enable row level security;
alter table public.deals force row level security;

create policy "deals_public_read" on public.deals
  for select to anon, authenticated using (true);
create policy "deals_admin_write" on public.deals
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.deals to anon, authenticated;
grant insert, update, delete on public.deals to authenticated;
