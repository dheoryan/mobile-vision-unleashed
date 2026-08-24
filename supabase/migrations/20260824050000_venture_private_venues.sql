-- Accepted-member location tier for Ventures.
--
-- RED under CHANGE_PROTOCOL: every policy below changes access. Written and
-- rehearsed with the feature, but never apply without Kila's explicit approval.
--
-- This table stores only the host's own arrival instructions. It never stores
-- Google's formattedAddress. The public venue label remains on venue_places;
-- the exact meeting point appears only after acceptance.

create table if not exists public.venture_venues (
  venture_id      uuid primary key references public.ventures(id) on delete cascade,
  arrival_details text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint venture_venues_arrival_present
    check (char_length(btrim(arrival_details)) between 1 and 280)
);

alter table public.venture_venues enable row level security;

drop policy if exists "Host and accepted members read private venue" on public.venture_venues;
create policy "Host and accepted members read private venue"
  on public.venture_venues for select to authenticated
  using (
    public.is_venture_host(venture_id, auth.uid())
    or public.is_venture_member(venture_id, auth.uid())
  );

drop policy if exists "Hosts add private venue" on public.venture_venues;
create policy "Hosts add private venue"
  on public.venture_venues for insert to authenticated
  with check (public.is_venture_host(venture_id, auth.uid()));

drop policy if exists "Hosts update private venue" on public.venture_venues;
create policy "Hosts update private venue"
  on public.venture_venues for update to authenticated
  using (public.is_venture_host(venture_id, auth.uid()))
  with check (public.is_venture_host(venture_id, auth.uid()));

drop policy if exists "Hosts remove private venue" on public.venture_venues;
create policy "Hosts remove private venue"
  on public.venture_venues for delete to authenticated
  using (public.is_venture_host(venture_id, auth.uid()));

grant select, insert, update, delete on public.venture_venues to authenticated;
grant all on public.venture_venues to service_role;

comment on table public.venture_venues is
  'Host-authored exact arrival details. Readable only by the host and accepted Venture members.';
