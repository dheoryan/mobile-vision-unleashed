-- Editing or removing a Venture's photo was failing outright with "Direct
-- deletion from storage tables is not allowed. Use the Storage API instead."
--
-- cleanup_venture_image and cleanup_replaced_venture_image (both from
-- 20260820002400/20260820002500) ran `delete from storage.objects` directly
-- from a plpgsql trigger to remove the orphaned file. Supabase's storage
-- extension now guards storage.objects against exactly that: a raw SQL
-- DELETE only removes the catalog row, not the underlying object in the
-- bucket, so it added a protective trigger that raises this error for any
-- caller that isn't going through the real Storage API - including a
-- SECURITY DEFINER function. Because cleanup_replaced_venture_image ran
-- AFTER UPDATE OF image_url, every single photo swap or removal on
-- HostForm's "Edit Venture" sheet hit this and rolled the whole update back.
--
-- The fix is to stop trying to delete the object from SQL at all. The app
-- already holds an authenticated Storage client for the host in
-- updateHostedVenture, and "Users delete own venture images" (from the same
-- 20260820002400 migration) already lets a host remove their own object
-- through the real Storage API - so cleanup now happens there instead,
-- right after a successful image_url change (see ventures.functions.ts).

drop trigger if exists trg_cleanup_replaced_venture_image on public.ventures;
drop function if exists public.cleanup_replaced_venture_image();

drop trigger if exists trg_cleanup_venture_image on public.ventures;
drop function if exists public.cleanup_venture_image();
