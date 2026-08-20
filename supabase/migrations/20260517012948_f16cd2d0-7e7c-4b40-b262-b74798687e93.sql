alter table public.notifications add column if not exists venture_id uuid;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like','comment','reply','mention','follow','message','new_post',
    'venture_apply','venture_accept','venture_message'
  ]));