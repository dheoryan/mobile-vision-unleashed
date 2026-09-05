-- Run inside a transaction after the repair migration, then ROLLBACK.
-- Temporary tables exercise the real production guard functions and FK
-- cascade with an authenticated JWT, without changing any application rows.
create temp table delete_test_posts (id uuid primary key);
create temp table delete_test_dm (like public.messages including defaults);
create temp table delete_test_tribe (like public.tribe_messages including defaults);
alter table delete_test_dm add foreign key (shared_post_id) references delete_test_posts(id) on delete set null;
alter table delete_test_tribe add foreign key (shared_post_id) references delete_test_posts(id) on delete set null;
create trigger guard before update on delete_test_dm for each row execute function public.enforce_dm_message_edit_fields();
create trigger guard before update on delete_test_tribe for each row execute function public.enforce_tribe_message_edit_fields();

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
insert into delete_test_posts values ('20000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002');
insert into delete_test_dm (sender_id, recipient_id, content, shared_post_id, deleted_at)
select sender, '10000000-0000-0000-0000-000000000003', 'Shared a post', '20000000-0000-0000-0000-000000000001', removed
from unnest(array['10000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000002'::uuid]) sender
cross join unnest(array[null::timestamptz, now()]) removed;
insert into delete_test_tribe (sender_id, tribe_id, content, shared_post_id, deleted_at)
select sender_id, '30000000-0000-0000-0000-000000000001', content, shared_post_id, deleted_at from delete_test_dm;
create temp table delete_test_before as
select 'dm' as kind, id, to_jsonb(m) - 'shared_post_id' as preserved from delete_test_dm m
union all select 'tribe', id, to_jsonb(m) - 'shared_post_id' from delete_test_tribe m;

-- A sender cannot clear or retarget the reference directly.
do $$
declare tbl text; target uuid;
begin
  foreach tbl in array array['delete_test_dm', 'delete_test_tribe'] loop
    foreach target in array array[null::uuid, '20000000-0000-0000-0000-000000000002'::uuid] loop
      begin
        execute format('update %I set shared_post_id = $1 where sender_id = auth.uid() and deleted_at is null', tbl) using target;
        raise exception 'Guard failed to reject direct reference change';
      exception when raise_exception then
        if sqlerrm = 'Guard failed to reject direct reference change' then raise; end if;
      end;
    end loop;
  end loop;
end;
$$;

-- Includes other senders and already-unsent messages in both surfaces.
delete from delete_test_posts where id = '20000000-0000-0000-0000-000000000001';
do $$
begin
  if exists (select 1 from delete_test_posts where id = '20000000-0000-0000-0000-000000000001') then
    raise exception 'Post was not deleted';
  end if;
  if (select count(*) from delete_test_dm where shared_post_id is null) <> 4
     or (select count(*) from delete_test_tribe where shared_post_id is null) <> 4 then
    raise exception 'Shared messages were removed or references were not cleared';
  end if;
  if exists (select 1 from delete_test_dm m join delete_test_before b on b.kind = 'dm' and b.id = m.id
             where b.preserved is distinct from to_jsonb(m) - 'shared_post_id')
     or exists (select 1 from delete_test_tribe m join delete_test_before b on b.kind = 'tribe' and b.id = m.id
                where b.preserved is distinct from to_jsonb(m) - 'shared_post_id') then
    raise exception 'Reference cleanup changed message content or metadata';
  end if;
end;
$$;

-- Guards still protect other senders and removed messages after cleanup.
do $$
declare tbl text; condition text;
begin
  foreach tbl in array array['delete_test_dm', 'delete_test_tribe'] loop
    foreach condition in array array['sender_id <> auth.uid()', 'sender_id = auth.uid() and deleted_at is not null'] loop
      begin
        execute format('update %I set content = ''tampered'' where %s', tbl, condition);
        raise exception 'Guard allowed forbidden content change';
      exception when raise_exception then
        if sqlerrm = 'Guard allowed forbidden content change' then raise; end if;
      end;
    end loop;
    execute format('update %I set content = ''legitimate edit'' where sender_id = auth.uid() and deleted_at is null', tbl);
  end loop;
  raise notice 'PASS: deletion clears 8 shared references, preserves messages, rejects direct reference changes and forbidden edits, and allows sender edits';
end;
$$;
