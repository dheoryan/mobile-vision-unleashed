
-- 1. Backfill handles for users without one
update public.profiles
set handle = lower(regexp_replace(coalesce(nullif(display_name,''), 'user'), '[^a-zA-Z0-9]', '', 'g'))
            || '_' || substring(id::text, 1, 6)
where handle is null or handle = '';

-- 2. Trigger to auto-assign handle on insert/update if missing
create or replace function public.ensure_profile_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.handle is null or new.handle = '' then
    new.handle := lower(regexp_replace(coalesce(nullif(new.display_name,''), 'user'), '[^a-zA-Z0-9]', '', 'g'))
                 || '_' || substring(new.id::text, 1, 6);
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_handle_before_write on public.profiles;
create trigger ensure_handle_before_write
before insert or update on public.profiles
for each row execute function public.ensure_profile_handle();

-- 3. Saved posts (bookmarks)
create table if not exists public.saved_posts (
  user_id uuid not null,
  post_id uuid not null,
  created_at timestamp with time zone not null default now(),
  primary key (user_id, post_id)
);
alter table public.saved_posts enable row level security;

create policy "Users see their own saves"
on public.saved_posts for select to authenticated
using (user_id = auth.uid());

create policy "Users save as themselves"
on public.saved_posts for insert to authenticated
with check (user_id = auth.uid());

create policy "Users unsave their own"
on public.saved_posts for delete to authenticated
using (user_id = auth.uid());

create index if not exists saved_posts_user_idx on public.saved_posts(user_id, created_at desc);

-- 4. Ventures history
create table if not exists public.ventures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  intents text[] not null default '{}',
  scope text not null default 'all',
  time_window text not null default '',
  created_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone
);
alter table public.ventures enable row level security;

create policy "Users see their own ventures"
on public.ventures for select to authenticated
using (user_id = auth.uid());

create policy "Users create their own ventures"
on public.ventures for insert to authenticated
with check (user_id = auth.uid());

create policy "Users end their own ventures"
on public.ventures for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists ventures_user_idx on public.ventures(user_id, created_at desc);
