-- User-controlled Web Push categories. These preferences affect only external
-- push delivery; the in-app activity inbox remains complete and authoritative.

create table if not exists public.push_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  messages_mentions boolean not null default true,
  venture_activity boolean not null default true,
  social_activity boolean not null default true,
  tribe_activity boolean not null default true,
  new_posts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_notification_preferences enable row level security;

drop policy if exists "Users read own push preferences" on public.push_notification_preferences;
create policy "Users read own push preferences"
on public.push_notification_preferences
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Users create own push preferences" on public.push_notification_preferences;
create policy "Users create own push preferences"
on public.push_notification_preferences
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users update own push preferences" on public.push_notification_preferences;
create policy "Users update own push preferences"
on public.push_notification_preferences
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.push_notification_preferences to authenticated;

create or replace function public.touch_push_notification_preferences_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_push_notification_preferences_updated_at() from public;
revoke execute on function public.touch_push_notification_preferences_updated_at() from anon, authenticated;

drop trigger if exists touch_push_notification_preferences_updated_at
on public.push_notification_preferences;
create trigger touch_push_notification_preferences_updated_at
before update on public.push_notification_preferences
for each row execute function public.touch_push_notification_preferences_updated_at();
