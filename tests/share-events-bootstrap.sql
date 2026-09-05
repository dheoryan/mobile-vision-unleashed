-- Minimal isolated schema for rehearsing the share-events migration.
-- The orphaned legacy row mirrors production data left behind after a post
-- was deleted; the migration must ignore it without weakening the new FK.
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
grant usage on schema auth, public to authenticated;

create table auth.users(id uuid primary key);
create table public.posts(
  id uuid primary key,
  shares_count integer not null default 0
);
create table public.shares(
  user_id uuid,
  post_id uuid,
  created_at timestamptz default now(),
  primary key(user_id, post_id)
);
create table public.messages(
  id uuid primary key,
  sender_id uuid,
  shared_post_id uuid references public.posts on delete set null
);
create table public.tribe_messages(like public.messages including all);

alter table public.posts enable row level security;
create policy posts_read on public.posts for select to authenticated using (true);
grant select on public.posts to authenticated;
grant select, insert, delete on public.messages, public.tribe_messages to authenticated;

insert into auth.users values ('10000000-0000-0000-0000-000000000001');
insert into public.posts values ('20000000-0000-0000-0000-000000000001', 1);
insert into public.shares(user_id, post_id) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', 'ec09624c-9535-4804-9334-d3e9325d5144');
