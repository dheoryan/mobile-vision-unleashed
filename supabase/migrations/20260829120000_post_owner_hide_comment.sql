-- Lets a post's author remove a hostile or unwanted comment from their own
-- post without needing a moderator - reusing the exact visibility mechanism
-- the moderation queue already uses (`moderation_hidden_at`), just reachable
-- by the person the comment actually affects. Deliberately a hide, not a
-- delete: non-destructive, reversible, and moderators can still see it -
-- and it needs zero RLS policy changes, since "Hidden comments stay in
-- moderation" (20260820001200_moderation_queue.sql) already filters on this
-- column for everyone who isn't a moderator.
--
-- `security definer` mirrors `has_blocked`'s pattern (2.2 in AGENTS.md: a
-- sub-select inside an RLS-guarded query is itself RLS-filtered, so the
-- ownership check below must not depend on the caller's filtered view of
-- `posts`).
create or replace function public.hide_own_post_comment(_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_row public.comments;
  post_owner uuid;
begin
  select * into comment_row from public.comments where id = _comment_id;
  if not found then
    raise exception 'Comment not found';
  end if;

  select author_id into post_owner from public.posts where id = comment_row.post_id;
  if post_owner is null or post_owner <> auth.uid() then
    raise exception 'Only the post''s author can hide a comment on it';
  end if;

  update public.comments
  set moderation_hidden_at = now(), moderation_hidden_by = auth.uid()
  where id = _comment_id;
end;
$$;

grant execute on function public.hide_own_post_comment(uuid) to authenticated;
