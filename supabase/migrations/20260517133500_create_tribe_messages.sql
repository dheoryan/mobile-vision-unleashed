-- Dedicated Tribe group chat table.
-- Tribe chat is separate from Venture party chat.

-- Ensure there is a UUID-backed Tribe catalog for chat foreign keys.
create table if not exists public.tribes (
  id uuid primary key default gen_random_uuid(),
  key text,
  name text,
  created_at timestamptz not null default now()
);

alter table public.tribes
  add column if not exists key text,
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists tribes_key_unique_idx
on public.tribes (key)
where key is not null;

create unique index if not exists tribes_name_unique_idx
on public.tribes (name)
where name is not null;

alter table public.tribes enable row level security;

drop policy if exists "Authenticated users can read tribes" on public.tribes;

create policy "Authenticated users can read tribes"
on public.tribes
for select
to authenticated
using (true);

insert into public.tribes (key, name)
select seed.key, seed.name
from (
  values
    ('wolf', 'Iron Wolf'),
    ('koi', 'Koi'),
    ('cat', 'Studio Cat'),
    ('owl', 'Night Owl'),
    ('bee', 'Honeybee')
) as seed(key, name)
where not exists (
  select 1
  from public.tribes t
  where t.key = seed.key
     or t.name = seed.name
);

create table if not exists public.tribe_members (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid references public.tribes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.tribe_members
  add column if not exists tribe_id uuid references public.tribes(id) on delete cascade,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

create index if not exists tribe_members_tribe_user_idx
on public.tribe_members (tribe_id, user_id);

create index if not exists tribe_members_tribe_profile_idx
on public.tribe_members (tribe_id, profile_id);

insert into public.tribe_members (tribe_id, user_id)
select distinct t.id, p.id
from public.profiles p
cross join lateral unnest(coalesce(p.tribe_ids, '{}'::text[])) as profile_tribe(key)
join public.tribes t
  on t.key = profile_tribe.key
  or t.name = profile_tribe.key
where not exists (
  select 1
  from public.tribe_members tm
  where tm.tribe_id = t.id
    and tm.user_id = p.id
);

create or replace function public.is_tribe_member(
  p_tribe_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  result boolean := false;
  has_user_id boolean := false;
  has_profile_id boolean := false;
begin
  if p_tribe_id is null or p_user_id is null then
    return false;
  end if;

  if to_regclass('public.tribe_members') is null then
    return false;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tribe_members'
      and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tribe_members'
      and column_name = 'profile_id'
  ) into has_profile_id;

  if has_user_id then
    execute '
      select exists (
        select 1
        from public.tribe_members
        where tribe_id = $1
          and user_id = $2
      )
    '
    into result
    using p_tribe_id, p_user_id;

    return coalesce(result, false);
  end if;

  if has_profile_id then
    execute '
      select exists (
        select 1
        from public.tribe_members
        where tribe_id = $1
          and profile_id = $2
      )
    '
    into result
    using p_tribe_id, p_user_id;

    return coalesce(result, false);
  end if;

  return false;
end;
$$;

create table if not exists public.tribe_messages (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  attachment_url text,
  attachment_type text,
  reply_to_id uuid references public.tribe_messages(id) on delete set null,
  mentions uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  constraint tribe_messages_has_content_or_attachment
    check (
      nullif(trim(coalesce(content, '')), '') is not null
      or attachment_url is not null
    )
);

alter table public.tribe_messages enable row level security;

create index if not exists tribe_messages_tribe_created_idx
on public.tribe_messages (tribe_id, created_at);

create index if not exists tribe_messages_sender_idx
on public.tribe_messages (sender_id);

create index if not exists tribe_messages_reply_to_idx
on public.tribe_messages (reply_to_id);

drop policy if exists "Tribe members can read tribe messages" on public.tribe_messages;

create policy "Tribe members can read tribe messages"
on public.tribe_messages
for select
to authenticated
using (
  public.is_tribe_member(tribe_id, auth.uid())
);

drop policy if exists "Tribe members can send tribe messages" on public.tribe_messages;

create policy "Tribe members can send tribe messages"
on public.tribe_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_tribe_member(tribe_id, auth.uid())
);

drop policy if exists "Users can delete own tribe messages" on public.tribe_messages;

create policy "Users can delete own tribe messages"
on public.tribe_messages
for delete
to authenticated
using (
  sender_id = auth.uid()
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tribe-chat-attachments',
  'tribe-chat-attachments',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "Tribe chat attachments are readable" on storage.objects;

    create policy "Tribe chat attachments are readable"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'tribe-chat-attachments'
    );

    drop policy if exists "Authenticated users can upload tribe chat attachments" on storage.objects;

    create policy "Authenticated users can upload tribe chat attachments"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'tribe-chat-attachments'
      and owner = auth.uid()
    );
  end if;
end $$;

notify pgrst, 'reload schema';
