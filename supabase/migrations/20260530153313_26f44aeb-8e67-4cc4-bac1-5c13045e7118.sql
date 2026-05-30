
-- 1) Enable RLS on tribe_members and add membership-scoped policies
ALTER TABLE public.tribe_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own tribe memberships"
ON public.tribe_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR profile_id = auth.uid());

GRANT SELECT ON public.tribe_members TO authenticated;
GRANT ALL ON public.tribe_members TO service_role;

-- 2) Remove duplicate permissive policies on tribe_messages that bypass membership check
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.tribe_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.tribe_messages;
-- Also drop the duplicate SELECT policy that bypasses is_tribe_member helper
DROP POLICY IF EXISTS "Members read tribe messages" ON public.tribe_messages;

-- 3) Restrict tribe-chat-attachments storage SELECT to tribe members
-- Paths are stored as "<tribeId>/<userId>-<suffix>"
DROP POLICY IF EXISTS "Tribe chat attachments are readable" ON storage.objects;

CREATE POLICY "Tribe members read tribe chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'tribe-chat-attachments'
  AND public.is_tribe_member((storage.foldername(name))[1], auth.uid())
);

-- 4) Lock down SECURITY DEFINER helper functions: revoke from PUBLIC/anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.is_tribe_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tribe_member(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_venture_host(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_venture_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_venture_joinable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_venture_application(uuid, uuid) FROM PUBLIC, anon;
