import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRIBE_IDS } from "@/lib/profile.functions";

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
  audience: "tribe" | "all";
  content: string;
  /** Short-lived signed URL for rendering. Never persisted. */
  image_url: string | null;
  /** Private storage object path, used only when the author edits the post. */
  image_path: string | null;
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
const POST_IMAGE_BUCKET = "post-images";
const POST_IMAGE_PATH = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/[A-Za-z0-9._-]+$/i;

function isPostImagePath(value: string | null): value is string {
  return !!value && POST_IMAGE_PATH.test(value);
}

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

async function attachPostImageUrls<T extends { image_url: string | null }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: T[],
): Promise<(Omit<T, "image_url"> & { image_path: string | null; image_url: string | null })[]> {
  const paths = Array.from(new Set(rows.map((row) => row.image_url).filter(isPostImagePath)));
  if (!paths.length) {
    return rows.map((row) => ({ ...row, image_path: null }));
  }

  const { data, error } = await supabase.storage.from(POST_IMAGE_BUCKET).createSignedUrls(paths, 3600);
  if (error) throw new Error(error.message);
  const urlsByPath = new Map(
    (data ?? []).map((item: { path: string; signedUrl: string | null }) => [item.path, item.signedUrl]),
  );

  return rows.map((row) => {
    if (!isPostImagePath(row.image_url)) return { ...row, image_path: null };
    return {
      ...row,
      image_path: row.image_url,
      image_url: urlsByPath.get(row.image_url) ?? null,
    };
  });
}

async function hydratePosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
): Promise<FeedPost[]> {
  return attachPostImageUrls(supabase, await attachAuthors(supabase, rows)) as Promise<FeedPost[]>;
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
  "id, author_id, tribe_id, audience, content, image_url, tag, likes_count, replies_count, shares_count, created_at";

const COMMENT_COLS =
  "id, post_id, author_id, content, created_at, parent_id, mentions";

/**
 * Two feeds, two audiences, no overlap.
 *
 *   tribe_id given → the Tribe feed: posts made *to* that Tribe, and nothing else.
 *   tribe_id absent → the Global feed: posts broadcast to everyone.
 *
 * This used to be `tribe_id.eq.X OR audience.eq.all`, which meant every global
 * broadcast also appeared in every Tribe tab. Because the query then took the
 * newest 200 rows overall, a Tribe tab would fill with platform-wide posts as
 * soon as broadcast volume outpaced that Tribe's own posting rate — the Iron
 * Wolf tab could contain zero Iron Wolf posts while its header said "Posts from
 * Iron Wolf". "Tribe only" has to actually mean tribe only, or the audience
 * rule is unlearnable.
 *
 * `tribe_id` is constrained to the known Tribe enum rather than a free string:
 * it is interpolated into a PostgREST filter, and commas/parens/dots in a raw
 * value could reshape the query. RLS bounds the blast radius, but the enum
 * removes the class of problem.
 */
export const listFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tribe_id: z.enum(TRIBE_IDS).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("posts")
      .select(POST_COLS)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.tribe_id) {
      q = q.eq("tribe_id", data.tribe_id).eq("audience", "tribe");
    } else {
      q = q.eq("audience", "all");
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return hydratePosts(supabase, rows ?? []);
  });

export const getPostById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("posts")
      .select(POST_COLS)
      .eq("id", data.post_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return (await hydratePosts(supabase, [row]))[0];
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
    return hydratePosts(supabase, rows ?? []);
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
    return hydratePosts(supabase, rows ?? []);
  });

const createSchema = z.object({
  tribe_id: z.string().min(1).max(40),
  content: z.string().max(280).default(""),
  image_path: z.string().regex(POST_IMAGE_PATH, "Invalid post image path").max(200).nullable().optional(),
  tag: z.string().max(40).nullable().optional(),
  audience: z.enum(["tribe", "all"]).default("tribe"),
  mentions: z.array(z.string().uuid()).max(20).optional().default([]),
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.content.trim() && !data.image_path) {
      throw new Error("Post can't be empty");
    }
    if (data.image_path && !data.image_path.startsWith(`${userId}/`)) {
      throw new Error("Post images must belong to the author");
    }
    let result = await supabase
      .from("posts")
      .insert({
        author_id: userId,
        tribe_id: data.tribe_id,
        content: data.content,
        image_url: data.image_path ?? null,
        tag: data.tag ?? null,
        audience: data.audience,
        mentions: data.mentions,
      })
      .select(POST_COLS)
      .single();
    if (["PGRST204", "42703"].includes(result.error?.code ?? "")) {
      result = await supabase
        .from("posts")
        .insert({
          author_id: userId,
          tribe_id: data.tribe_id,
          content: data.content,
          image_url: data.image_path ?? null,
          tag: data.tag ?? null,
          audience: data.audience,
        })
        .select(POST_COLS)
        .single();
    }
    const { data: row, error } = result;
    if (error) throw new Error(error.message);
    return (await hydratePosts(supabase, [row]))[0];
  });

const editSchema = z.object({
  id: z.string().uuid(),
  content: z.string().max(280),
  image_path: z.string().regex(POST_IMAGE_PATH, "Invalid post image path").max(200).nullable().optional(),
});

export const editPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => editSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.image_path && !data.image_path.startsWith(`${userId}/`)) {
      throw new Error("Post images must belong to the author");
    }
    const patch: { content: string; image_url?: string | null } = { content: data.content };
    if (data.image_path !== undefined) patch.image_url = data.image_path;
    const { data: row, error } = await supabase
      .from("posts")
      .update(patch)
      .eq("id", data.id)
      .select(POST_COLS)
      .single();
    if (error) throw new Error(error.message);
    return (await hydratePosts(supabase, [row]))[0];
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
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const newestWindow = [...(rows ?? [])].reverse();
    return (await attachAuthors(supabase, newestWindow as any)) as CommentRow[];
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
    return hydratePosts(supabase, orderedRows);
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
