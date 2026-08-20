-- Notify users with a follow edge (either direction) when a new post is created.
CREATE OR REPLACE FUNCTION public.notify_followers_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  recipient uuid;
  preview_text text;
begin
  preview_text := left(coalesce(new.content, ''), 140);

  for recipient in
    select distinct uid from (
      -- People who follow the author
      select follower_id as uid from public.follows where followee_id = new.author_id
      union
      -- People the author follows
      select followee_id as uid from public.follows where follower_id = new.author_id
    ) s
    where uid <> new.author_id
  loop
    insert into public.notifications (user_id, actor_id, kind, post_id, preview)
    values (recipient, new.author_id, 'new_post', new.id, preview_text);
  end loop;

  return null;
end;
$$;

DROP TRIGGER IF EXISTS notify_followers_on_post_trigger ON public.posts;
CREATE TRIGGER notify_followers_on_post_trigger
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.notify_followers_on_post();