-- 1) Defense-in-depth: prevent users from self-upgrading `plan` via direct profile update.
CREATE OR REPLACE FUNCTION public.prevent_plan_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    -- Only allow when no auth context (i.e. service role / trusted server function).
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'plan changes are not permitted via profile update';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_plan_self_change ON public.profiles;
CREATE TRIGGER prevent_plan_self_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_plan_self_change();

-- 2) Realtime channel authorization. The realtime.messages table governs
--    who can SUBSCRIBE to a channel topic. We scope subscriptions so a user
--    can only subscribe to their own DM/notification channels, and to tribe
--    channels they're a member of. Unscoped/public topics remain open.
-- LOCAL-DEV PATCH: on Supabase CLI's local stack, the migration role isn't
-- the owner of realtime.messages (it's owned by supabase_admin), so ALTER/
-- CREATE POLICY on it raises "must be owner of table messages". Wrapped so
-- a fresh local database doesn't abort here; on the hosted project the
-- migration role already has the right privileges so this still applies.
do $$
begin
  begin
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users subscribe to authorized realtime topics" ON realtime.messages;
    CREATE POLICY "Users subscribe to authorized realtime topics"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      -- Per-user channels: topic encodes the user_id (e.g. "user:<uuid>" or "notifications:<uuid>")
      (realtime.topic() LIKE 'user:%'          AND split_part(realtime.topic(), ':', 2) = auth.uid()::text)
      OR (realtime.topic() LIKE 'notifications:%' AND split_part(realtime.topic(), ':', 2) = auth.uid()::text)
      OR (realtime.topic() LIKE 'dm:%'         AND split_part(realtime.topic(), ':', 2) = auth.uid()::text)
      -- Tribe channels: topic like "tribe:<tribe_id>" — must be in the user's tribe_ids
      OR (
        realtime.topic() LIKE 'tribe:%'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND split_part(realtime.topic(), ':', 2) = ANY (p.tribe_ids)
        )
      )
      -- Public/shared topics (timeline, presence, etc.) explicitly allowed
      OR realtime.topic() IN ('timeline', 'presence', 'public')
    );
  exception when insufficient_privilege then
    raise notice 'Skipping realtime.messages RLS setup: insufficient privilege in this environment (expected on some local Supabase CLI stacks)';
  end;
end $$;

-- 3) Storage: post-images bucket is intentionally public (images served by URL).
--    Add an explicit public SELECT policy to document that intent.
DROP POLICY IF EXISTS "Post images are publicly readable" ON storage.objects;
CREATE POLICY "Post images are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'post-images');
