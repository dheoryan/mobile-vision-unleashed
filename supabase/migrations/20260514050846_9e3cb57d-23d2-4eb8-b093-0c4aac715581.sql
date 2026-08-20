-- ENUMS
create type public.app_plan as enum ('free', 'plus');
create type public.report_kind as enum ('post', 'user', 'comment');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  handle text unique,
  age int check (age is null or age >= 21),
  city text not null default '',
  bio text not null default '',
  avatar_url text,
  avatar_emoji text not null default '🌿',
  plan public.app_plan not null default 'free',
  tribe_ids text[] not null default '{}',
  venture_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.enforce_tribe_limit()
returns trigger language plpgsql as $$
declare
  max_allowed int;
begin
  max_allowed := case when new.plan = 'plus' then 3 else 1 end;
  if coalesce(array_length(new.tribe_ids, 1), 0) > max_allowed then
    raise exception 'Plan % allows at most % tribe(s), got %', new.plan, max_allowed, array_length(new.tribe_ids,1);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_tribe_limit
before insert or update on public.profiles
for each row execute function public.enforce_tribe_limit();

alter table public.profiles enable row level security;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- BLOCKS (define before posts so policies can reference)
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

create policy "Users see their own blocks"
  on public.blocks for select to authenticated using (auth.uid() = blocker_id);

create policy "Users create their own blocks"
  on public.blocks for insert to authenticated with check (auth.uid() = blocker_id);

create policy "Users delete their own blocks"
  on public.blocks for delete to authenticated using (auth.uid() = blocker_id);

-- has_blocked helper avoids RLS recursion
create or replace function public.has_blocked(_viewer uuid, _target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = _viewer and blocked_id = _target)
       or (blocker_id = _target  and blocked_id = _viewer)
  )
$$;

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  tribe_id text not null,
  content text not null default '',
  image_url text,
  tag text,
  likes_count int not null default 0,
  replies_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_tribe_idx on public.posts(tribe_id);
create index posts_author_idx on public.posts(author_id);
create index posts_created_idx on public.posts(created_at desc);

alter table public.posts enable row level security;

create policy "Posts visible if not blocked"
  on public.posts for select to authenticated
  using (not public.has_blocked(auth.uid(), author_id));

create policy "Authors create posts"
  on public.posts for insert to authenticated
  with check (author_id = auth.uid());

create policy "Authors update own posts"
  on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "Authors delete own posts"
  on public.posts for delete to authenticated using (author_id = auth.uid());

-- COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments(post_id, created_at);

alter table public.comments enable row level security;

create policy "Comments visible if author not blocked"
  on public.comments for select to authenticated
  using (not public.has_blocked(auth.uid(), author_id));

create policy "Users create own comments"
  on public.comments for insert to authenticated
  with check (author_id = auth.uid());

create policy "Authors delete own comments"
  on public.comments for delete to authenticated using (author_id = auth.uid());

-- counters
create or replace function public.bump_replies_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set replies_count = replies_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set replies_count = greatest(replies_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger comments_count after insert or delete on public.comments
for each row execute function public.bump_replies_count();

-- LIKES
create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;

create policy "Likes visible to authenticated"
  on public.likes for select to authenticated using (true);

create policy "Users like as themselves"
  on public.likes for insert to authenticated with check (user_id = auth.uid());

create policy "Users unlike their own"
  on public.likes for delete to authenticated using (user_id = auth.uid());

create or replace function public.bump_likes_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger likes_count after insert or delete on public.likes
for each row execute function public.bump_likes_count();

-- FOLLOWS
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;

create policy "Follows visible to authenticated"
  on public.follows for select to authenticated using (true);

create policy "Users follow as themselves"
  on public.follows for insert to authenticated with check (follower_id = auth.uid());

create policy "Users unfollow their own"
  on public.follows for delete to authenticated using (follower_id = auth.uid());

-- REPORTS
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_kind public.report_kind not null,
  target_id text not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "Users see their own reports"
  on public.reports for select to authenticated using (reporter_id = auth.uid());

create policy "Users file their own reports"
  on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true) on conflict (id) do nothing;

create policy "Public read avatars"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Public read post images"
  on storage.objects for select using (bucket_id = 'post-images');
create policy "Users upload own post image"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own post image"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
