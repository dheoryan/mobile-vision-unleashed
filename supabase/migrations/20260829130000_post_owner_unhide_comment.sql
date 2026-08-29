-- The other half of hide_own_post_comment (20260829120000): a post owner
-- needs to (a) see which comments on their post they've hidden, since RLS
-- hides them from everyone but moderators - including the person who hid
-- them - and (b) reverse it.
--
-- Both are deliberately scoped to `moderation_hidden_by = auth.uid()`, not
-- "any hidden comment on my post": a comment a moderator hid for a policy
-- violation is a moderation decision, not the post owner's to unilaterally
-- reverse. Only the person who did the hiding can undo it.

create or replace function public.list_hidden_comments_on_my_post(_post_id uuid)
returns setof public.comments
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.post_id = _post_id
    and p.author_id = auth.uid()
    and c.moderation_hidden_by = auth.uid()
  order by c.created_at asc
$$;

grant execute on function public.list_hidden_comments_on_my_post(uuid) to authenticated;

create or replace function public.unhide_own_post_comment(_comment_id uuid)
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
    raise exception 'Only the post''s author can unhide a comment on it';
  end if;

  if comment_row.moderation_hidden_by is distinct from auth.uid() then
    raise exception 'Only the person who hid this comment can unhide it';
  end if;

  update public.comments
  set moderation_hidden_at = null, moderation_hidden_by = null
  where id = _comment_id;
end;
$$;

grant execute on function public.unhide_own_post_comment(uuid) to authenticated;
