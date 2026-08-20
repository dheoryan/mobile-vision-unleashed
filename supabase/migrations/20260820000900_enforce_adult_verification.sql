-- L7: date-of-birth verification is enforced in Postgres, not trusted to UI.
-- A profile may be incomplete (OAuth creates the auth row before we know DOB),
-- but incomplete/underage profiles cannot read or write social/meetup data.

alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists adult_verified_at timestamptz,
  add column if not exists age_verification_locked_at timestamptz;

create or replace function public.age_in_years(value date)
returns integer
language sql
stable
set search_path = public
as $$
  select extract(year from age(current_date, value))::integer
$$;

revoke all on function public.age_in_years(date) from public;
grant execute on function public.age_in_years(date) to authenticated, service_role;

create or replace function public.apply_profile_age_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  years integer;
begin
  if new.date_of_birth is distinct from old.date_of_birth then
    if old.date_of_birth is not null then
      raise exception 'Date of birth cannot be changed after verification';
    end if;

    if new.date_of_birth is null
      or new.date_of_birth > current_date
      or new.date_of_birth < (current_date - interval '120 years')::date then
      raise exception 'Invalid date of birth';
    end if;

    years := public.age_in_years(new.date_of_birth);
    if years >= 21 then
      new.age := years;
      new.adult_verified_at := now();
      new.age_verification_locked_at := null;
    else
      new.age := null;
      new.adult_verified_at := null;
      new.age_verification_locked_at := now();
    end if;
  elsif new.age is distinct from old.age
    or new.adult_verified_at is distinct from old.adult_verified_at
    or new.age_verification_locked_at is distinct from old.age_verification_locked_at then
    raise exception 'Age verification fields cannot be edited directly';
  end if;

  return new;
end;
$$;

revoke all on function public.apply_profile_age_verification() from public;
revoke execute on function public.apply_profile_age_verification() from anon, authenticated;

drop trigger if exists apply_profile_age_verification_before_update on public.profiles;
create trigger apply_profile_age_verification_before_update
before update on public.profiles
for each row execute function public.apply_profile_age_verification();

-- Email signup supplies DOB in auth metadata. OAuth accounts deliberately get
-- an incomplete profile and must verify on the first authenticated screen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dob_text text;
  dob date;
  years integer;
begin
  dob_text := nullif(new.raw_user_meta_data->>'date_of_birth', '');

  if dob_text is not null then
    begin
      dob := dob_text::date;
    exception when others then
      raise exception 'Invalid date of birth';
    end;

    if dob > current_date or dob < (current_date - interval '120 years')::date then
      raise exception 'Invalid date of birth';
    end if;

    years := public.age_in_years(dob);
  end if;

  insert into public.profiles (
    id,
    display_name,
    date_of_birth,
    age,
    adult_verified_at,
    age_verification_locked_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    dob,
    case when years >= 21 then years else null end,
    case when years >= 21 then now() else null end,
    case when years is not null and years < 21 then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_verified_adult(profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.adult_verified_at is not null
      and p.age >= 21
  )
$$;

revoke all on function public.is_verified_adult(uuid) from public;
revoke execute on function public.is_verified_adult(uuid) from anon;
grant execute on function public.is_verified_adult(uuid) to authenticated, service_role;

create or replace function public.require_verified_adult()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Internal migration/maintenance sessions have no JWT. Authenticated API
  -- traffic always has auth.uid(); anon writes remain blocked by RLS.
  if auth.uid() is not null and not public.is_verified_adult(auth.uid()) then
    raise exception 'Adult verification is required';
  end if;
  return new;
end;
$$;

revoke all on function public.require_verified_adult() from public;
revoke execute on function public.require_verified_adult() from anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'posts',
    'comments',
    'messages',
    'tribe_messages',
    'ventures',
    'venture_applications',
    'venture_messages'
  ] loop
    execute format('drop trigger if exists require_adult_before_write on public.%I', table_name);
    execute format(
      'create trigger require_adult_before_write before insert or update on public.%I for each row execute function public.require_verified_adult()',
      table_name
    );
  end loop;
end
$$;

-- Restrictive policies are ANDed with the existing per-table authorization.
create policy "Only verified adults read profiles"
on public.profiles as restrictive
for select to authenticated
using (id = auth.uid() or public.is_verified_adult(auth.uid()));

create policy "Only verified adults read posts"
on public.posts as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));

create policy "Only verified adults read comments"
on public.comments as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));

create policy "Only verified adults read messages"
on public.messages as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));

create policy "Only verified adults read Tribe chat"
on public.tribe_messages as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));

create policy "Only verified adults read Ventures"
on public.ventures as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));

create policy "Only verified adults read Venture applications"
on public.venture_applications as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));

create policy "Only verified adults read Venture chat"
on public.venture_messages as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));

create policy "Only verified adults upload social images"
on storage.objects as restrictive
for insert to authenticated
with check (
  bucket_id not in ('avatars', 'post-images', 'tribe-chat-attachments')
  or public.is_verified_adult(auth.uid())
);

comment on column public.profiles.date_of_birth is
  'Immutable first-submitted DOB used for server-side adult verification.';
comment on column public.profiles.adult_verified_at is
  'Non-null only after Postgres verifies the immutable DOB is age 21+.';
comment on column public.profiles.age_verification_locked_at is
  'Set when the immutable first-submitted DOB is ineligible.';
