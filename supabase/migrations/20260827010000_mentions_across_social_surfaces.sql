-- One mention contract across posts, comments, Tribe chat, and Venture chat.
-- IDs are stored for durable delivery, while the trigger verifies that the
-- matching @handle is actually present and that the recipient can see the
-- surface. This prevents a forged UUID array from becoming a notification
-- spam primitive.

alter table public.posts
  add column if not exists mentions uuid[] not null default '{}'::uuid[];

alter table public.venture_messages
  add column if not exists mentions uuid[] not null default '{}'::uuid[];

alter table public.posts drop constraint if exists posts_mentions_limit;
alter table public.posts
  add constraint posts_mentions_limit check (cardinality(mentions) <= 20);

alter table public.comments drop constraint if exists comments_mentions_limit;
alter table public.comments
  add constraint comments_mentions_limit check (cardinality(mentions) <= 20);

alter table public.tribe_messages drop constraint if exists tribe_messages_mentions_limit;
alter table public.tribe_messages
  add constraint tribe_messages_mentions_limit check (cardinality(mentions) <= 20);

alter table public.venture_messages drop constraint if exists venture_messages_mentions_limit;
alter table public.venture_messages
  add constraint venture_messages_mentions_limit check (cardinality(mentions) <= 20);

create or replace function public.content_mentions_user(_content text, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    cross join lateral regexp_split_to_table(
      lower(coalesce(_content, '')),
      '[^@a-z0-9_.-]+'
    ) as token(value)
    where p.id = _user_id
      and nullif(btrim(p.handle), '') is not null
      and token.value = '@' || lower(ltrim(p.handle, '@'))
  )
$$;

revoke all on function public.content_mentions_user(text, uuid)
  from public, anon, authenticated;

create or replace function public.notify_on_post_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  for recipient in
    select distinct mention.user_id
    from unnest(coalesce(new.mentions, '{}'::uuid[])) as mention(user_id)
  loop
    if recipient <> new.author_id
       and public.content_mentions_user(new.content, recipient)
       and (
         new.audience = 'all'
         or exists (
           select 1 from public.profiles p
           where p.id = recipient and p.tribe_ids @> array[new.tribe_id]::text[]
         )
       ) then
      insert into public.notifications (user_id, actor_id, kind, post_id, preview)
      values (recipient, new.author_id, 'mention', new.id, left(new.content, 140));
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.notify_on_post_mention()
  from public, anon, authenticated;

drop trigger if exists notify_on_post_mention on public.posts;
create trigger notify_on_post_mention
after insert on public.posts
for each row execute function public.notify_on_post_mention();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
  parent_author uuid;
  post_audience text;
  post_tribe text;
  recipient uuid;
begin
  select author_id, audience, tribe_id
    into author, post_audience, post_tribe
  from public.posts
  where id = new.post_id;

  if new.parent_id is not null then
    select author_id into parent_author
    from public.comments
    where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, preview)
      values (parent_author, new.author_id, 'reply', new.post_id, new.id, left(new.content, 140));
    end if;
  end if;

  if author is not null
     and author <> new.author_id
     and (new.parent_id is null or author <> coalesce(parent_author, '00000000-0000-0000-0000-000000000000'::uuid)) then
    insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, preview)
    values (author, new.author_id, 'comment', new.post_id, new.id, left(new.content, 140));
  end if;

  for recipient in
    select distinct mention.user_id
    from unnest(coalesce(new.mentions, '{}'::uuid[])) as mention(user_id)
  loop
    if recipient <> new.author_id
       and recipient <> coalesce(author, '00000000-0000-0000-0000-000000000000'::uuid)
       and recipient <> coalesce(parent_author, '00000000-0000-0000-0000-000000000000'::uuid)
       and public.content_mentions_user(new.content, recipient)
       and (
         post_audience = 'all'
         or exists (
           select 1 from public.profiles p
           where p.id = recipient and p.tribe_ids @> array[post_tribe]::text[]
         )
       ) then
      insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, preview)
      values (recipient, new.author_id, 'mention', new.post_id, new.id, left(new.content, 140));
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.notify_on_comment()
  from public, anon, authenticated;

create or replace function public.notify_on_tribe_message_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  if new.room_kind is not null then return null; end if;

  for recipient in
    select distinct mention.user_id
    from unnest(coalesce(new.mentions, '{}'::uuid[])) as mention(user_id)
  loop
    if recipient <> new.sender_id
       and public.is_tribe_member(new.tribe_id, recipient)
       and public.content_mentions_user(new.content, recipient) then
      insert into public.notifications (
        user_id, actor_id, kind, message_id, tribe_id, preview
      ) values (
        recipient, new.sender_id, 'mention', new.id, new.tribe_id, left(new.content, 140)
      );
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.notify_on_tribe_message_mention()
  from public, anon, authenticated;

drop trigger if exists notify_on_tribe_message_mention on public.tribe_messages;
create trigger notify_on_tribe_message_mention
after insert on public.tribe_messages
for each row execute function public.notify_on_tribe_message_mention();

-- Venture members receive one notification per message. A direct mention is
-- labelled as such; everybody else keeps the normal party-chat notification.
create or replace function public.notify_on_venture_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  notification_kind text;
begin
  if coalesce(new.message_kind, 'user') <> 'user' then return null; end if;

  for recipient in
    select distinct uid from (
      select user_id as uid from public.ventures where id = new.venture_id
      union
      select applicant_id as uid
      from public.venture_applications
      where venture_id = new.venture_id and status = 'accepted'
    ) members
    where uid <> new.sender_id
  loop
    notification_kind := case
      when recipient = any(coalesce(new.mentions, '{}'::uuid[]))
       and public.content_mentions_user(new.content, recipient)
      then 'mention'
      else 'venture_message'
    end;

    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (
      recipient,
      new.sender_id,
      notification_kind,
      new.venture_id,
      left(new.content, 140)
    );
  end loop;
  return null;
end;
$$;

revoke all on function public.notify_on_venture_message()
  from public, anon, authenticated;

comment on column public.posts.mentions is
  'Profile ids selected through the post @mention picker; trigger-valid only when the matching handle is present.';
comment on column public.venture_messages.mentions is
  'Venture participant ids selected through the party-chat @mention picker.';
