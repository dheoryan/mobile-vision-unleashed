
-- Add shares feature + improve realtime delete payloads

-- 1. shares table (one share per user per post)
CREATE TABLE public.shares (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shares visible to authenticated"
ON public.shares FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users share as themselves"
ON public.shares FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users unshare their own"
ON public.shares FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. shares_count on posts
ALTER TABLE public.posts ADD COLUMN shares_count integer NOT NULL DEFAULT 0;

-- 3. trigger to maintain shares_count
CREATE OR REPLACE FUNCTION public.bump_shares_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set shares_count = shares_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set shares_count = greatest(shares_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

CREATE TRIGGER shares_bump_count
AFTER INSERT OR DELETE ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.bump_shares_count();

-- 4. Make sure DELETE realtime payloads include the row data we need
ALTER TABLE public.likes REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.shares REPLICA IDENTITY FULL;

-- 5. realtime publication for shares
ALTER PUBLICATION supabase_realtime ADD TABLE public.shares;
