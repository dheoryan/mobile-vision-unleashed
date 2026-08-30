-- RED migration: trigger bindings and function security are access-sensitive,
-- and the final reconciliation updates existing post rows. Apply manually in
-- Lovable SQL Editor after taking a production backup.
--
-- The 20260820001000 migration already intended these counters to be atomic
-- and SECURITY DEFINER. This migration makes that invariant explicit again,
-- replaces any legacy trigger binding left by production drift, and repairs
-- counts that may have been missed while a SECURITY INVOKER function was live.

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
revoke all on function public.sync_shares_count() from public, anon, authenticated;

-- Retain no active path through the original SECURITY INVOKER functions.
drop trigger if exists likes_bump_count on public.likes;
drop trigger if exists likes_count on public.likes;
create trigger likes_count
after insert or delete on public.likes
for each row execute function public.sync_likes_count();

drop trigger if exists shares_bump_count on public.shares;
drop trigger if exists shares_count on public.shares;
create trigger shares_count
after insert or delete on public.shares
for each row execute function public.sync_shares_count();

-- Repair drift in one set-based pass. DISTINCT FROM avoids rewriting posts
-- whose stored values already match the relational source of truth.
with actual as (
  select
    p.id,
    coalesce(l.total, 0)::integer as likes_count,
    coalesce(s.total, 0)::integer as shares_count
  from public.posts p
  left join (
    select post_id, count(*) as total
    from public.likes
    group by post_id
  ) l on l.post_id = p.id
  left join (
    select post_id, count(*) as total
    from public.shares
    group by post_id
  ) s on s.post_id = p.id
)
update public.posts p
set
  likes_count = actual.likes_count,
  shares_count = actual.shares_count
from actual
where p.id = actual.id
  and (
    p.likes_count is distinct from actual.likes_count
    or p.shares_count is distinct from actual.shares_count
  );

