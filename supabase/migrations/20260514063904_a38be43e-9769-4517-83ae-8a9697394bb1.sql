revoke execute on function public.sync_likes_count() from public;
revoke execute on function public.sync_likes_count() from anon;
revoke execute on function public.sync_likes_count() from authenticated;

revoke execute on function public.sync_replies_count() from public;
revoke execute on function public.sync_replies_count() from anon;
revoke execute on function public.sync_replies_count() from authenticated;

revoke execute on function public.sync_shares_count() from public;
revoke execute on function public.sync_shares_count() from anon;
revoke execute on function public.sync_shares_count() from authenticated;