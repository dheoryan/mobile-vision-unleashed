create or replace function public.sync_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  target_post_id := coalesce(new.post_id, old.post_id);

  update public.posts p
  set likes_count = (
    select count(*)::int
    from public.likes l
    where l.post_id = target_post_id
  )
  where p.id = target_post_id;

  return null;
end;
$$;

create or replace function public.sync_replies_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  target_post_id := coalesce(new.post_id, old.post_id);

  update public.posts p
  set replies_count = (
    select count(*)::int
    from public.comments c
    where c.post_id = target_post_id
  )
  where p.id = target_post_id;

  return null;
end;
$$;

create or replace function public.sync_shares_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
begin
  target_post_id := coalesce(new.post_id, old.post_id);

  update public.posts p
  set shares_count = (
    select count(*)::int
    from public.shares s
    where s.post_id = target_post_id
  )
  where p.id = target_post_id;

  return null;
end;
$$;

drop trigger if exists likes_count on public.likes;
drop trigger if exists likes_bump_count on public.likes;
create trigger likes_count
after insert or delete on public.likes
for each row execute function public.sync_likes_count();

drop trigger if exists comments_count on public.comments;
drop trigger if exists comments_bump_count on public.comments;
create trigger comments_count
after insert or delete on public.comments
for each row execute function public.sync_replies_count();

drop trigger if exists shares_count on public.shares;
drop trigger if exists shares_bump_count on public.shares;
create trigger shares_count
after insert or delete on public.shares
for each row execute function public.sync_shares_count();

with counts as (
  select
    p.id,
    coalesce(l.c, 0)::int as likes_count,
    coalesce(c.c, 0)::int as replies_count,
    coalesce(s.c, 0)::int as shares_count
  from public.posts p
  left join (select post_id, count(*) c from public.likes group by post_id) l on l.post_id = p.id
  left join (select post_id, count(*) c from public.comments group by post_id) c on c.post_id = p.id
  left join (select post_id, count(*) c from public.shares group by post_id) s on s.post_id = p.id
)
update public.posts p
set
  likes_count = counts.likes_count,
  replies_count = counts.replies_count,
  shares_count = counts.shares_count
from counts
where p.id = counts.id;

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.likes'::regclass
  ) then
    alter publication supabase_realtime add table public.likes;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.comments'::regclass
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.shares'::regclass
  ) then
    alter publication supabase_realtime add table public.shares;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.posts'::regclass
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.follows'::regclass
  ) then
    alter publication supabase_realtime add table public.follows;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.profiles'::regclass
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;