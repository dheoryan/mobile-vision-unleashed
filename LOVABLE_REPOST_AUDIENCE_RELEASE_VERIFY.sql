-- Run after 20260830100000_repost_audience.sql. Every row must return true.
select 'reposts audience column' as check_name,
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'reposts'
           and column_name = 'audience' and is_nullable = 'NO'
       ) as ok
union all
select 'reposts tribe column',
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'reposts'
           and column_name = 'tribe_id'
       )
union all
select 'repost audience constraints',
       count(*) = 2
from pg_constraint
where conrelid = 'public.reposts'::regclass
  and conname in ('reposts_audience_check', 'reposts_audience_tribe_check')
union all
select 'repost audience trigger',
       exists (
         select 1 from pg_trigger
         where tgrelid = 'public.reposts'::regclass
           and tgname = 'validate_repost_audience_before_insert'
           and not tgisinternal
       )
union all
select 'repost audience policy',
       exists (
         select 1 from pg_policies
         where schemaname = 'public' and tablename = 'reposts'
           and policyname = 'Reposts visible by audience'
           and qual like '%is_tribe_member%'
       )
union all
select 'repost audience index',
       to_regclass('public.reposts_audience_tribe_created_idx') is not null
union all
select 'comment repost can narrow public source',
       pg_get_functiondef('public.validate_comment_repost_insert()'::regprocedure)
         like '%source_audience = ''tribe''%';
