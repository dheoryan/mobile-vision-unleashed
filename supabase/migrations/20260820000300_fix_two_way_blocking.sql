-- Restore the SECURITY DEFINER helper removed in 20260514051017. Inline
-- subqueries against blocks are RLS-filtered, so they cannot observe a block
-- created by the other participant.
create or replace function public.has_blocked(_viewer uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _viewer = auth.uid()
    and exists (
      select 1
      from public.blocks
      where (blocker_id = _viewer and blocked_id = _target)
         or (blocker_id = _target and blocked_id = _viewer)
    )
$$;

revoke execute on function public.has_blocked(uuid, uuid) from public, anon;
grant execute on function public.has_blocked(uuid, uuid) to authenticated;

drop policy if exists "Posts visible by audience and not blocked" on public.posts;
create policy "Posts visible by audience and not blocked"
on public.posts
for select
to authenticated
using (
  not public.has_blocked(auth.uid(), author_id)
  and (
    author_id = auth.uid()
    or audience = 'all'
    or (
      audience = 'tribe'
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and posts.tribe_id = any (p.tribe_ids)
      )
    )
  )
);

drop policy if exists "Comments visible if post visible and author not blocked" on public.comments;
create policy "Comments visible if post visible and author not blocked"
on public.comments
for select
to authenticated
using (
  not public.has_blocked(auth.uid(), author_id)
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and (
        p.author_id = auth.uid()
        or p.audience = 'all'
        or (
          p.audience = 'tribe'
          and exists (
            select 1
            from public.profiles pr
            where pr.id = auth.uid()
              and p.tribe_id = any (pr.tribe_ids)
          )
        )
      )
  )
);

drop policy if exists "Senders insert messages" on public.messages;
create policy "Senders insert messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and not public.has_blocked(auth.uid(), recipient_id)
);
