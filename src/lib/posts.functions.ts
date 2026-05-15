import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuthorLite = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string;
  avatar_url: string | null;
  plan: "free" | "plus";
};

export type FeedPost = {
  id: string;
  author_id: string;
  tribe_id: string;
  content: string;
  image_url: string | null;
  tag: string | null;
  likes_count: number;
  replies_count: number;
  shares_count: number;
  created_at: string;
  author: AuthorLite | null;
};

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  mentions: string[];
  author: AuthorLite | null;
};

export type CommentMutationResult = CommentRow & { replies_count: number };

const AUTHOR_COLS = "id, display_name, handle, avatar_emoji, avatar_url, plan";

async function attachAuthors<T extends { author_id: string }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: T[],
): Promise<(T & { author: AuthorLite | null })[]> {
  if (!rows.length) return [];
  const ids = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data, error } = await supabase
    .from("profiles")
    .select(AUTHOR_COLS)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const map = new Map<string, AuthorLite>();
  for (const a of (data ?? []) as AuthorLite[]) map.set(a.id, a);
  return rows.map((r) => ({ ...r, author: map.get(r.author_id) ?? null }));
}

async function getRepliesCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  postId: string,
) {
  const { count, error } = await supabase
    .from("comments")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

const POST_COLS =
  "id, author_id, tribe_id, content, image_url, tag, likes_count, replies_count, shares_count, created_at";

const COMMENT_COLS =
  "id, post_id, author_id, content, created_at, parent_id, mentions";

export const listFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tribe_id: z.string().min(1).max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("posts")
      .select(POST_COLS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.tribe_id) q = q.eq("tribe_id", data.tribe_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (await attachAuthors(supabase, (rows ?? []) as any)) as FeedPost[];
  });

export const listMyPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("posts")
      .select(POST_COLS)
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (await attachAuthors(supabase, (rows ?? []) as any)) as FeedPost[];
  });

export const listPostsByAuthor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ author_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("posts")
      .select(POST_COLS)
      .eq("author_id", data.author_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (await attachAuthors(supabase, (rows ?? []) as any)) as FeedPost[];
  });

const createSchema = z.object({
  tribe_id: z.string().min(1).max(40),
  content: z.string().max(280).default(""),
  image_url: z.string().url().max(2000).nullable().optional(),
  tag: z.string().max(40).nullable().optional(),
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.content.trim() && !data.image_url) {
      throw new Error("Post can't be empty");
    }
    const { data: row, error } = await supabase
      .from("posts")
      .insert({
        author_id: userId,
        tribe_id: data.tribe_id,
        content: data.content,
        image_url: data.image_url ?? null,
        tag: data.tag ?? null,
      })
      .select(POST_COLS)
      .single();
    if (error) throw new Error(error.message);
    const [withAuthor] = await attachAuthors(supabase, [row as any]);
    return withAuthor as FeedPost;
  });

const editSchema = z.object({
  id: z.string().uuid(),
  content: z.string().max(280),
  image_url: z.string().url().max(2000).nullable().optional(),
});

export const editPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => editSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { content: string; image_url?: string | null } = { content: data.content };
    if (data.image_url !== undefined) patch.image_url = data.image_url;
    const { data: row, error } = await supabase
      .from("posts")
      .update(patch)
      .eq("id", data.id)
      .select(POST_COLS)
      .single();
    if (error) throw new Error(error.message);
    const [withAuthor] = await attachAuthors(supabase, [row as any]);
    return withAuthor as FeedPost;
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("comments")
      .select(COMMENT_COLS)
      .eq("post_id", data.post_id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (await attachAuthors(supabase, (rows ?? []) as any)) as CommentRow[];
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      post_id: z.string().uuid(),
      content: z.string().min(1).max(500),
      parent_id: z.string().uuid().nullable().optional(),
      mentions: z.array(z.string().uuid()).max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("comments")
      .insert({
        post_id: data.post_id,
        author_id: userId,
        content: data.content,
        parent_id: data.parent_id ?? null,
        mentions: data.mentions ?? [],
      })
      .select(COMMENT_COLS)
      .single();
    if (error) throw new Error(error.message);
    const [withAuthor] = await attachAuthors(supabase, [row as any]);
    return { ...(withAuthor as CommentRow), replies_count: await getRepliesCount(supabase, data.post_id) };
  });

// ---------- Saved posts (bookmarks) ----------

export const listMySavedIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as { post_id: string }[]).map((r) => r.post_id);
  });

export const listMySavedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: saves, error: e1 } = await supabase
      .from("saved_posts")
      .select("post_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (e1) throw new Error(e1.message);
    const ids = ((saves ?? []) as { post_id: string }[]).map((r) => r.post_id);
    if (!ids.length) return [] as FeedPost[];
    const { data: rows, error: e2 } = await supabase
      .from("posts")
      .select(POST_COLS)
      .in("id", ids);
    if (e2) throw new Error(e2.message);
    const orderedRows = ids
      .map((id) => (rows ?? []).find((r: { id: string }) => r.id === id))
      .filter(Boolean) as { author_id: string }[];
    return (await attachAuthors(supabase, orderedRows as any)) as FeedPost[];
  });

export const toggleSavePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", userId)
      .eq("post_id", data.post_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("saved_posts")
        .delete()
        .eq("user_id", userId)
        .eq("post_id", data.post_id);
      if (error) throw new Error(error.message);
      return { saved: false, post_id: data.post_id };
    }
    const { error } = await supabase
      .from("saved_posts")
      .insert({ user_id: userId, post_id: data.post_id });
    if (error) throw new Error(error.message);
    return { saved: true, post_id: data.post_id };
  });

// ---------- Ventures history ----------

export type VentureRow = {
  id: string;
  user_id: string;
  intents: string[];
  scope: string;
  time_window: string;
  created_at: string;
  ended_at: string | null;
};

export const listMyVentures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ventures")
      .select("id, user_id, intents, scope, time_window, created_at, ended_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as VentureRow[];
  });

export const launchVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      intents: z.array(z.string().min(1).max(40)).max(10),
      scope: z.enum(["mine", "all"]),
      time_window: z.string().max(60),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ventures")
      .insert({
        user_id: userId,
        intents: data.intents,
        scope: data.scope,
        time_window: data.time_window,
      })
      .select("id, user_id, intents, scope, time_window, created_at, ended_at")
      .single();
    if (error) throw new Error(error.message);
    // Also bump profile.venture_count
    await supabase.rpc("noop").then(() => null).catch(() => null);
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("venture_count")
      .eq("id", userId)
      .maybeSingle();
    const next = (profileRow?.venture_count ?? 0) + 1;
    await supabase.from("profiles").update({ venture_count: next }).eq("id", userId);
    return row as VentureRow;
  });

export const endVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ventures")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

// ---------- Tribe member counts ----------

export const getTribeMemberCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tribe_ids: z.array(z.string().min(1).max(40)).min(1).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const out: Record<string, number> = {};
    await Promise.all(
      data.tribe_ids.map(async (tid) => {
        const { count, error } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .contains("tribe_ids", [tid]);
        if (error) throw new Error(error.message);
        out[tid] = count ?? 0;
      }),
    );
    return out;
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing, error: lookupError } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", data.id)
      .single();
    if (lookupError) throw new Error(lookupError.message);
    const postId = existing.post_id as string;
    const { error } = await supabase.from("comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id, post_id: postId, replies_count: await getRepliesCount(supabase, postId) };
  });
