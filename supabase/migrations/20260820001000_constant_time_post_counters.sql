-- P4: maintain post counters with atomic deltas instead of count(*) rescans.
-- The one-time reconciliation fixes any existing drift; every later mutation
-- performs a single indexed post-row update regardless of engagement volume.

with counts as (
  select
    p.id,
    coalesce(l.total, 0)::integer as likes_count,
    coalesce(c.total, 0)::integer as replies_count,
    coalesce(s.total, 0)::integer as shares_count
  from public.posts p
  left join (
    select post_id, count(*) as total from public.likes group by post_id
  ) l on l.post_id = p.id
  left join (
    select post_id, count(*) as total from public.comments group by post_id
  ) c on c.post_id = p.id
  left join (
    select post_id, count(*) as total from public.shares group by post_id
  ) s on s.post_id = p.id
)
update public.posts p
set
  likes_count = counts.likes_count,
  replies_count = counts.replies_count,
  shares_count = counts.shares_count
from counts
where p.id = counts.id;

create or replace function public.sync_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set likes_count = likes_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

create or replace function public.sync_replies_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set replies_count = replies_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set replies_count = greatest(replies_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

create or replace function public.sync_shares_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set shares_count = shares_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set shares_count = greatest(shares_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_likes_count() from public, anon, authenticated;
revoke all on function public.sync_replies_count() from public, anon, authenticated;
revoke all on function public.sync_shares_count() from public, anon, authenticated;
