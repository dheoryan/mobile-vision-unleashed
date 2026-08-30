-- Reposts choose their own destination without ever widening the source.
-- Existing rows keep their current behavior: public sources remain Wild
-- reposts and Tribe-only sources remain in that source Tribe.

alter table public.reposts add column audience text;
alter table public.reposts add column tribe_id text;

update public.reposts r
set audience = p.audience,
    tribe_id = case when p.audience = 'tribe' then p.tribe_id else null end
from public.posts p
where p.id = r.post_id;

alter table public.reposts alter column audience set default 'all';
alter table public.reposts alter column audience set not null;
alter table public.reposts add constraint reposts_audience_check
  check (audience in ('tribe', 'all'));
alter table public.reposts add constraint reposts_audience_tribe_check
  check (
    (audience = 'all' and tribe_id is null)
    or (audience = 'tribe' and tribe_id is not null)
  );

create index reposts_audience_tribe_created_idx
  on public.reposts(audience, tribe_id, created_at desc);

-- The trigger is the authority for the destination. It resolves the viewer's
-- current exclusive Tribe itself, so a direct PostgREST caller cannot spoof a
-- different Tribe id. The source lookup remains invoker-mode and therefore
-- passes through post RLS.
create or replace function public.validate_repost_audience_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_audience text;
  source_tribe text;
  viewer_tribe text;
begin
  select p.audience, p.tribe_id
    into source_audience, source_tribe
  from public.posts p
  where p.id = new.post_id;

  if not found then
    raise exception 'Signal is not available to repost';
  end if;

  select viewer.tribe_ids[1]
    into viewer_tribe
  from public.profiles viewer
  where viewer.id = auth.uid();

  if viewer_tribe is null then
    raise exception 'Choose a Tribe before reposting';
  end if;

  if source_audience = 'tribe' then
    if new.audience <> 'tribe' then
      raise exception 'A Tribe-only signal cannot be reposted to The Wild';
    end if;
    if viewer_tribe <> source_tribe then
      raise exception 'Only members of this Tribe can repost this signal';
    end if;
  end if;

  if new.audience = 'tribe' then
    new.tribe_id := viewer_tribe;
  elsif new.audience = 'all' then
    new.tribe_id := null;
  else
    raise exception 'Invalid repost audience';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_repost_audience_insert()
  from public, anon, authenticated;

create trigger validate_repost_audience_before_insert
before insert on public.reposts
for each row execute function public.validate_repost_audience_insert();

drop policy if exists "Reposts visible to authenticated" on public.reposts;
create policy "Reposts visible by audience"
on public.reposts
for select
to authenticated
using (
  user_id = auth.uid()
  or audience = 'all'
  or (
    audience = 'tribe'
    and public.is_tribe_member(tribe_id, auth.uid())
  )
);

-- Comment reposts are normal posts. Let a public comment be narrowed to the
-- reposter's Tribe, while keeping a Tribe-only comment locked to its source.
create or replace function public.validate_comment_repost_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_tribe text;
  source_audience text;
  viewer_tribe text;
begin
  if new.quoted_comment_id is null then
    return new;
  end if;

  select p.tribe_id, p.audience
    into source_tribe, source_audience
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = new.quoted_comment_id;

  if not found then
    raise exception 'Comment is not available to repost';
  end if;

  select viewer.tribe_ids[1]
    into viewer_tribe
  from public.profiles viewer
  where viewer.id = auth.uid();

  if viewer_tribe is null then
    raise exception 'Choose a Tribe before reposting';
  end if;

  if source_audience = 'tribe' then
    if new.audience <> 'tribe' or viewer_tribe <> source_tribe then
      raise exception 'A Tribe comment must stay inside its source Tribe';
    end if;
  elsif new.audience not in ('tribe', 'all') then
    raise exception 'Invalid repost audience';
  end if;

  -- Every post has a home Tribe for attribution, including Wild posts.
  new.tribe_id := viewer_tribe;
  return new;
end;
$$;

revoke all on function public.validate_comment_repost_insert()
  from public, anon, authenticated;
