drop policy if exists "Posts visible if not blocked" on public.posts;
drop policy if exists "Comments visible if author not blocked" on public.comments;

create policy "Posts visible if not blocked"
  on public.posts for select to authenticated
  using (
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = posts.author_id)
         or (b.blocker_id = posts.author_id and b.blocked_id = auth.uid())
    )
  );

create policy "Comments visible if author not blocked"
  on public.comments for select to authenticated
  using (
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = comments.author_id)
         or (b.blocker_id = comments.author_id and b.blocked_id = auth.uid())
    )
  );

drop function if exists public.has_blocked(uuid, uuid);
