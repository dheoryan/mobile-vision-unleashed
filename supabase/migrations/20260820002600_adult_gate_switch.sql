-- SHIP THE ADULT GATE INERT, ENABLE IT DELIBERATELY.
--
-- Why this exists:
--
-- 20260820000900 adds `as restrictive` policies to profiles, posts, comments,
-- messages, tribe_messages, ventures and venture_applications, all of which
-- call is_verified_adult(auth.uid()). It also adds the adult_verified_at
-- column in that same migration, so on any existing database every profile
-- has NULL there the instant it applies.
--
-- Restrictive policies are AND-ed with everything else. So on a database with
-- real users — which production has — applying that migration takes all seven
-- tables away from every single person at once. Not an error: the app just
-- renders empty, and nothing anywhere says why.
--
-- Grandfathering everyone with `adult_verified_at = now()` would keep the app
-- working, but it writes down that we verified people we never verified, which
-- is precisely the claim App Store 1.2 is about. So instead the gate ships
-- switched off, real verification happens while the app keeps working, and the
-- switch is thrown once the numbers say it is safe.
--
-- The switch lives inside is_verified_adult rather than in seven policy
-- definitions. That means every current policy respects it, and so does any
-- policy added later — nobody has to remember this file exists.

-- ---------- 1. the switch ----------

create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Deliberately no policies for anon/authenticated: nothing outside a
-- SECURITY DEFINER function or service_role should read or write this table.
-- adult_gate_enabled() is the only intended reader.

insert into public.app_settings (key, value)
values ('adult_gate_enabled', 'false'::jsonb)
on conflict (key) do nothing;   -- never re-disable a gate someone has enabled

comment on table public.app_settings is
  'Server-side feature switches. Read only through SECURITY DEFINER helpers; there are no RLS policies granting direct access on purpose.';

create or replace function public.adult_gate_enabled()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select value::text::boolean from public.app_settings where key = 'adult_gate_enabled'),
    false   -- missing row means off; failing open here is the safe direction,
            -- because failing closed would lock every user out of seven tables
  )
$$;

revoke all on function public.adult_gate_enabled() from public, anon;
grant execute on function public.adult_gate_enabled() to authenticated, service_role;

-- ---------- 2. teach the gate to respect the switch ----------
-- Body is otherwise identical to the version in 20260820001200 (the later of
-- the two definitions, which added the suspended_at check). Only the
-- short-circuit is new.

create or replace function public.is_verified_adult(profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not public.adult_gate_enabled()
      or exists (
        select 1
        from public.profiles p
        where p.id = profile_id
          and p.adult_verified_at is not null
          and p.age >= 21
          and p.suspended_at is null
      )
$$;

revoke all on function public.is_verified_adult(uuid) from public;
revoke execute on function public.is_verified_adult(uuid) from anon;
grant execute on function public.is_verified_adult(uuid) to authenticated, service_role;

comment on function public.is_verified_adult(uuid) is
  'True when the adult gate is disabled, or when the profile is a verified, non-suspended 21+ adult. The short-circuit is what lets 20260820000900 deploy to a populated database without locking every existing user out of seven tables at once.';

-- ---------- 3. how to turn it on, when you are ready ----------
--
-- Check first — this is the number that matters:
--
--   select count(*) filter (where adult_verified_at is null) as not_yet,
--          count(*)                                          as total
--   from public.profiles where suspended_at is null;
--
-- Every profile still in `not_yet` loses access the moment you run:
--
--   update public.app_settings
--   set value = 'true'::jsonb, updated_at = now()
--   where key = 'adult_gate_enabled';
--
-- It is reversible in one statement — set it back to 'false' — which is the
-- other reason for doing it this way rather than by backfilling data.
