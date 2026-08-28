-- A Tribe-only post is unreadable outside its Tribe, so its activity signal
-- must never be fanned out to a cross-Tribe follow edge. Keep the existing
-- reciprocal follow audience, then apply the post's visibility boundary at
-- notification creation time. This protects both in-app and push delivery.

create or replace function public.notify_followers_on_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview_text text;
begin
  preview_text := left(coalesce(new.content, ''), 140);

  insert into public.notifications (user_id, actor_id, kind, post_id, preview)
  select recipients.user_id, new.author_id, 'new_post', new.id, preview_text
  from (
    select follower_id as user_id
    from public.follows
    where followee_id = new.author_id

    union

    select followee_id as user_id
    from public.follows
    where follower_id = new.author_id
  ) recipients
  where recipients.user_id <> new.author_id
    and (
      new.audience = 'all'
      or (
        new.audience = 'tribe'
        and exists (
          select 1
          from public.profiles recipient_profile
          where recipient_profile.id = recipients.user_id
            and recipient_profile.tribe_ids @> array[new.tribe_id]::text[]
        )
      )
    );

  return null;
end;
$$;

revoke all on function public.notify_followers_on_post()
  from public, anon, authenticated;

drop trigger if exists notify_followers_on_post_trigger on public.posts;
create trigger notify_followers_on_post_trigger
after insert on public.posts
for each row execute function public.notify_followers_on_post();

comment on function public.notify_followers_on_post() is
  'Notifies reciprocal follow edges about public posts, and only same-Tribe edges about Tribe-only posts.';
