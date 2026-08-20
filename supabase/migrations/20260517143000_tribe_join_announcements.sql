-- Tribe join announcements and notifications.
-- Additive only: no data reset, no table drops, no truncation.

alter table public.notifications
  add column if not exists tribe_id text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like',
    'comment',
    'reply',
    'mention',
    'follow',
    'message',
    'new_post',
    'venture_apply',
    'venture_accept',
    'venture_message',
    'tribe_join'
  ]));

create index if not exists idx_notifications_tribe
on public.notifications(tribe_id);

create or replace function public.handle_profile_tribe_joins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_tribes text[] := '{}'::text[];
  new_tribes text[] := '{}'::text[];
  joined_key text;
  target_tribe_id uuid;
  target_tribe_key text;
  target_tribe_name text;
  actor_name text;
  announcement text;
  recipient uuid;
  tribe_message_tribe_cast text := 'uuid';
  tribe_message_sender_cast text := 'uuid';
begin
  if new.id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    old_tribes := coalesce(old.tribe_ids, '{}'::text[]);
  end if;

  new_tribes := coalesce(new.tribe_ids, '{}'::text[]);
  actor_name := coalesce(nullif(trim(new.display_name), ''), 'A new member');

  for joined_key in
    select distinct value
    from unnest(new_tribes) as value
    where value is not null
      and value <> ''
      and not (value = any(old_tribes))
  loop
    select t.id, coalesce(t.key, joined_key), coalesce(t.name, joined_key)
    into target_tribe_id, target_tribe_key, target_tribe_name
    from public.tribes t
    where t.key = joined_key
       or t.name = joined_key
       or t.id::text = joined_key
    limit 1;

    if target_tribe_id is null then
      continue;
    end if;

    insert into public.tribe_members (tribe_id, user_id, profile_id)
    select target_tribe_id, new.id, new.id
    where not exists (
      select 1
      from public.tribe_members tm
      where tm.tribe_id = target_tribe_id
        and (
          tm.user_id = new.id
          or tm.profile_id = new.id
        )
    );

    announcement := actor_name || ' joined ' || target_tribe_name || '. Say hello.';

    select case when data_type = 'uuid' then 'uuid' else 'text' end
    into tribe_message_tribe_cast
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tribe_messages'
      and column_name = 'tribe_id';

    select case when data_type = 'uuid' then 'uuid' else 'text' end
    into tribe_message_sender_cast
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tribe_messages'
      and column_name = 'sender_id';

    tribe_message_tribe_cast := coalesce(tribe_message_tribe_cast, 'uuid');
    tribe_message_sender_cast := coalesce(tribe_message_sender_cast, 'uuid');

    execute
      'insert into public.tribe_messages (
        tribe_id,
        sender_id,
        content,
        attachment_type
      )
      values (
        $1::' || tribe_message_tribe_cast || ',
        $2::' || tribe_message_sender_cast || ',
        $3,
        $4
      )'
    using
      target_tribe_id::text,
      new.id::text,
      announcement,
      'system:tribe_join';

    for recipient in
      select distinct uid
      from (
        select p.id as uid
        from public.profiles p
        where p.id <> new.id
          and (
            coalesce(p.tribe_ids, '{}'::text[]) && array[target_tribe_key, target_tribe_name, target_tribe_id::text]
          )
        union
        select coalesce(tm.user_id, tm.profile_id) as uid
        from public.tribe_members tm
        where tm.tribe_id = target_tribe_id
      ) members
      where uid is not null
        and uid <> new.id
    loop
      insert into public.notifications (
        user_id,
        actor_id,
        kind,
        preview,
        tribe_id
      )
      values (
        recipient,
        new.id,
        'tribe_join',
        announcement,
        target_tribe_key
      );
    end loop;
  end loop;

  return new;
end;
$$;

revoke execute on function public.handle_profile_tribe_joins() from public, anon, authenticated;

drop trigger if exists trg_handle_profile_tribe_joins on public.profiles;
create trigger trg_handle_profile_tribe_joins
after insert or update of tribe_ids on public.profiles
for each row execute function public.handle_profile_tribe_joins();

do $$
begin
  begin alter publication supabase_realtime add table public.tribe_messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end $$;

notify pgrst, 'reload schema';
