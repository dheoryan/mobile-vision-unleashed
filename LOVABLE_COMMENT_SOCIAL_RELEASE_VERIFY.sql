-- Run after 20260830040000_comment_likes_and_reposts.sql.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'likes_count'
  ) as comments_have_likes_count,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'reposts_count'
  ) as comments_have_reposts_count,
  to_regclass('public.comment_likes') is not null as comment_likes_exists,
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'comment_likes' and c.relrowsecurity
  ) as comment_likes_rls_enabled,
  (select count(*) = 3 from pg_policies where schemaname = 'public' and tablename = 'comment_likes')
    as comment_likes_has_three_policies,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'quoted_comment_id'
  ) as posts_have_quoted_comment_id,
  to_regclass('public.posts_author_quoted_comment_unique') is not null
    as one_repost_per_user_comment,
  exists (
    select 1 from pg_trigger
    where tgname = 'comment_likes_count' and not tgisinternal
  ) as like_counter_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'comment_reposts_count' and not tgisinternal
  ) as repost_counter_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'trg_notify_on_comment_like' and not tgisinternal
  ) as like_notification_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'trg_notify_on_comment_repost' and not tgisinternal
  ) as repost_notification_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'validate_comment_repost_before_insert' and not tgisinternal
  ) as repost_audience_guard_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'protect_comment_repost_source' and not tgisinternal
  ) as repost_source_immutable;
