-- Add audience column to posts: 'tribe' (members of tribe_id only) or 'all' (every authenticated user)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'tribe';

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_audience_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_audience_check CHECK (audience IN ('tribe', 'all'));

CREATE INDEX IF NOT EXISTS posts_audience_idx ON public.posts (audience);

-- Replace SELECT policy to honor audience
DROP POLICY IF EXISTS "Posts visible if not blocked" ON public.posts;

CREATE POLICY "Posts visible by audience and not blocked"
ON public.posts
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = posts.author_id)
       OR (b.blocker_id = posts.author_id AND b.blocked_id = auth.uid())
  )
  AND (
    posts.author_id = auth.uid()
    OR posts.audience = 'all'
    OR (
      posts.audience = 'tribe'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND posts.tribe_id = ANY (p.tribe_ids)
      )
    )
  )
);
