-- ONE TRIBE PER USER, with a switch cooldown.
--
-- Product decision (user, 2026-08-20): Tribe membership becomes exclusive.
-- A person belongs to exactly one Tribe and may change it, but cannot stack
-- several. Tribe stops being a subscription list and becomes an identity.
--
-- Two supporting rules, and the reasoning for each:
--
--   1. A 21-day cooldown between switches. Without a cost, exclusive
--      membership means nothing — people hop between rooms and the identity
--      is hollow.
--
--   2. A 7-day onboarding grace window during which switches are unlimited.
--      This is the important one. A new user picks their Tribe having seen a
--      name, an emoji and a one-line description — they cannot know what the
--      room is actually like until they are in it. Locking a day-two
--      correction behind three weeks puts a hard wall at the single
--      highest-drop-off moment in the funnel; they don't wait, they leave.
--      Someone fixing an onboarding mistake in week one is not tribe-hopping.
--
-- Also fixes a real gap: leaving a Tribe previously updated profiles.tribe_ids
-- but never deleted the corresponding public.tribe_members row, and
-- handle_profile_tribe_joins only ever INSERTs. So a departed member kept
-- database-level read/write access to that Tribe's chat forever. Membership is
-- now reconciled on every change.

-- ---------- 1. schema ----------

alter table public.profiles
  add column if not exists tribe_changed_at timestamptz;

comment on column public.profiles.tribe_changed_at is
  'When tribe_ids last changed. Null means the tribe has never been changed since signup. Drives the switch cooldown.';

-- ---------- 2. collapse existing multi-tribe profiles to their primary ----------
-- tribe_ids[1] is the Tribe chosen at onboarding and the one the UI has always
-- treated as primary (ProfileScreen reads tribeIds[0]), so it is the correct
-- one to keep.

update public.profiles
set tribe_ids = array[tribe_ids[1]]
where coalesce(array_length(tribe_ids, 1), 0) > 1;

-- Drop tribe_members rows that no longer correspond to a profile's Tribe.
delete from public.tribe_members tm
where not exists (
  select 1
  from public.profiles p
  where p.id = tm.user_id
    and tm.tribe_id = any (p.tribe_ids)
);

-- ---------- 3. cap at one, and enforce the cooldown ----------

create or replace function public.enforce_tribe_limit()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  changed boolean;
  grace_days constant int := 7;
  cooldown_days constant int := 21;
begin
  if coalesce(array_length(new.tribe_ids, 1), 0) > 1 then
    raise exception 'A profile belongs to exactly one Tribe, got %',
      array_length(new.tribe_ids, 1)
      using hint = 'Switch Tribes instead of joining an additional one.';
  end if;

  -- Guard the UPDATE branch with a nested IF rather than a compound boolean.
  -- This trigger is BEFORE INSERT OR UPDATE, and OLD is null on INSERT; relying
  -- on AND to short-circuit before touching OLD.* is a footgun worth avoiding.
  changed := false;
  if tg_op = 'UPDATE' then
    changed := new.tribe_ids is distinct from old.tribe_ids
               and coalesce(array_length(old.tribe_ids, 1), 0) > 0;
  end if;

  if changed then
    -- service_role / SECURITY DEFINER paths bypass the cooldown by design
    -- (migrations, moderation, support).
    if auth.uid() is not null
       and now() - new.created_at >= make_interval(days => grace_days)
       and old.tribe_changed_at is not null
       and now() - old.tribe_changed_at < make_interval(days => cooldown_days)
    then
      raise exception 'You can change Tribe again in % day(s)',
        ceil(extract(epoch from (
          old.tribe_changed_at + make_interval(days => cooldown_days) - now()
        )) / 86400)::int
        using hint = 'Tribe changes are limited to one every 21 days.';
    end if;

    new.tribe_changed_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

-- ---------- 4. keep tribe_members in step with the profile's Tribe ----------
-- handle_profile_tribe_joins still handles the INSERT side and the join
-- announcement. This only removes memberships the user no longer holds.

create or replace function public.sync_tribe_membership_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tribe_ids is distinct from old.tribe_ids then
    delete from public.tribe_members tm
    where tm.user_id = new.id
      and not (tm.tribe_id = any (new.tribe_ids));
  end if;
  return new;
end;
$$;

revoke all on function public.sync_tribe_membership_on_change() from public, anon, authenticated;

drop trigger if exists trg_sync_tribe_membership on public.profiles;
create trigger trg_sync_tribe_membership
after update of tribe_ids on public.profiles
for each row execute function public.sync_tribe_membership_on_change();

-- ---------- 5. helper the UI uses to show remaining cooldown ----------

create or replace function public.tribe_switch_available_at(_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- still inside the onboarding grace window, or never switched
    when p.tribe_changed_at is null then null
    when now() - p.created_at < make_interval(days => 7) then null
    else p.tribe_changed_at + make_interval(days => 21)
  end
  from public.profiles p
  where p.id = _user_id;
$$;

revoke all on function public.tribe_switch_available_at(uuid) from public, anon;
grant execute on function public.tribe_switch_available_at(uuid) to authenticated;
