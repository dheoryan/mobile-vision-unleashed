-- Run after tests/share-events-bootstrap.sql and the migration in the
-- isolated share-event fixture database. The bootstrap includes one valid
-- legacy share and one orphan whose post has already been deleted.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select public.record_external_share('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','native');
select public.record_external_share('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','native');
select public.record_external_share('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','clipboard');
insert into messages values ('40000000-0000-0000-0000-000000000001',auth.uid(),'20000000-0000-0000-0000-000000000001');
insert into messages values ('40000000-0000-0000-0000-000000000002',auth.uid(),'20000000-0000-0000-0000-000000000001');
insert into tribe_messages values ('40000000-0000-0000-0000-000000000003',auth.uid(),'20000000-0000-0000-0000-000000000001');
do $$begin
 if (select shares_count from posts) <> 6 then raise exception 'repeat actions/retry count wrong'; end if;
 begin
   perform public.record_external_share('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','dm');
   raise exception 'forged channel allowed';
 exception when raise_exception then if sqlerrm = 'forged channel allowed' then raise; end if; end;
 begin
   insert into share_events(user_id,request_id,post_id,channel) values
   ('10000000-0000-0000-0000-000000000002',gen_random_uuid(),'20000000-0000-0000-0000-000000000001','native');
   raise exception 'forged actor allowed';
 exception when insufficient_privilege then null; end;
end$$;
delete from messages;
do $$begin
 if (select shares_count from posts) <> 6 then raise exception 'message deletion undid share'; end if;
end$$;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select public.record_external_share('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','native');
reset role;
do $$begin
 if (select shares_count from posts) <> 7 then raise exception 'second actor not counted'; end if;
end$$;
delete from auth.users;
do $$begin
 if exists(select 1 from share_events where user_id='10000000-0000-0000-0000-000000000001') then raise exception 'account actor retained'; end if;
 if (select shares_count from posts) <> 7 then raise exception 'anonymization changed count'; end if;
end$$;
delete from tribe_messages;
delete from posts;
do $$begin
 if exists(select 1 from share_events) then raise exception 'post event cascade failed'; end if;
 raise notice 'PASS: baseline, repeat sends, retry deduplication, second actor, forged requests, deletion, anonymization';
end$$;
rollback;
