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
  /** Short-lived signed URL for the cover photo (first image). Never persisted. */
  image_url: string | null;
  /** Private storage object path for the cover photo, used only when the author edits the post. */
  image_path: string | null;
  /** Every photo on the post, in order, as short-lived signed URLs. Empty for
   *  text-only posts; a single-entry array duplicates `image_url` for a
   *  one-photo post rather than being a special case to check for. */
  images: string[];
  /** The same photos as `images`, as raw storage paths in the same order -
   *  what an edit needs to hand back to set_post_images without re-uploading
   *  photos that didn't change. Never render these; they aren't URLs. */
  image_paths: string[];
  tag: string | null;
  likes_count: number;
  replies_count: number;
  shares_count: number;
  reposts_count: number;
  /** Set only on a feed entry that exists because someone reposted the
   *  underlying post - null for a post's own normal appearance. */
  reposted_by: AuthorLite | null;
  quoted_post_id: string | null;
  /** The quoted post, hydrated one level deep (a quoted post's own quote is
   *  never resolved further). Null both when nothing is quoted and when the
   *  quoted post has been deleted - callers distinguish via `quoted_post_id`. */
  quoted_post: FeedPost | null;
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
  const { data, error } = await supabase.from("profiles").select(AUTHOR_COLS).in("id", ids);
  if (error) throw new Error(error.message);
  const map = new Map<string, AuthorLite>();
  for (const a of (data ?? []) as AuthorLite[]) map.set(a.id, a);
  return rows.map((r) => ({ ...r, author: map.get(r.author_id) ?? null }));
}

export async function attachPostImageUrls<T extends { image_url: string | null }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: T[],
): Promise<(Omit<T, "image_url"> & { image_path: string | null; image_url: string | null })[]> {
  const paths = Array.from(new Set(rows.map((row) => row.image_url).filter(isPostImagePath)));
  if (!paths.length) {
    return rows.map((row) => ({ ...row, image_path: null }));
  }

  const { data, error } = await supabase.storage
    .from(POST_IMAGE_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error) throw new Error(error.message);
  const urlsByPath = new Map(
    (data ?? []).map((item: { path: string; signedUrl: string | null }) => [
      item.path,
      item.signedUrl,
    ]),
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

// Multi-photo carousel data, kept separate from attachPostImageUrls (which
// only ever resolves the single legacy `image_url` cover field) rather than
// merged into it - ProfileScreen and notifications only ever want the cover
// photo and have no reason to pay for signing every photo on every post
// they touch.
async function attachPostImages<T extends { id: string }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: T[],
): Promise<Map<string, { urls: string[]; paths: string[] }>> {
  const postIds = rows.map((r) => r.id);
  if (!postIds.length) return new Map();
  const { data: imgRows, error } = await supabase.rpc("list_post_images_for_posts", {
    _post_ids: postIds,
  });
  if (error) {
    // Unlike hideComment/unhideComment (gated behind a user clicking a
    // specific button, so their absence only breaks that one action),
    // this function backs every post read - listFeed, getPostById,
    // listMyPosts, all of it. If 20260829140000's migration hasn't
    // reached production yet but this code has, throwing here would take
    // the entire feed down instead of just leaving multi-photo posts
    // showing their cover only. PGRST202 is PostgREST's "function isn't in
    // the schema cache" - i.e. exactly "this migration isn't live yet" -
    // so only that one is swallowed; anything else still fails loudly.
    if (error.code === "PGRST202") return new Map();
    throw new Error(error.message);
  }
  // Already ordered by (post_id, position) - see 20260829140000's RPC.
  const rowsTyped = (imgRows ?? []) as { post_id: string; path: string }[];
  if (!rowsTyped.length) return new Map();

  const paths = Array.from(new Set(rowsTyped.map((r) => r.path)));
  const { data: signed, error: signError } = await supabase.storage
    .from(POST_IMAGE_BUCKET)
    .createSignedUrls(paths, 3600);
  if (signError) throw new Error(signError.message);
  const urlByPath = new Map<string, string | null>(
    (signed ?? []).map((item: { path: string; signedUrl: string | null }) => [
      item.path,
      item.signedUrl,
    ]),
  );

  const byPost = new Map<string, { urls: string[]; paths: string[] }>();
  for (const r of rowsTyped) {
    const url = urlByPath.get(r.path);
    if (!url) continue;
    const entry = byPost.get(r.post_id) ?? { urls: [], paths: [] };
    entry.urls.push(url);
    entry.paths.push(r.path);
    byPost.set(r.post_id, entry);
  }
  return byPost;
}

async function hydratePosts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  // `shallow` stops a quoted post from resolving its own quoted post -
  // matching Twitter/Threads' one-level-of-nesting convention and avoiding
  // unbounded recursion on a chain of quotes.
  options: { shallow?: boolean } = {},
): Promise<FeedPost[]> {
  const [withUrls, imagesByPost] = await Promise.all([
    attachPostImageUrls(supabase, await attachAuthors(supabase, rows)),
    attachPostImages(supabase, rows),
  ]);
  const hydrated = withUrls.map((p) => {
    const multi = imagesByPost.get(p.id);
    return {
      ...p,
      images: multi?.urls ?? (p.image_url ? [p.image_url] : []),
      image_paths: multi?.paths ?? (p.image_path ? [p.image_path] : []),
      reposted_by: null,
      quoted_post: null,
    };
  }) as FeedPost[];

  if (options.shallow) return hydrated;

  const quotedIds = Array.from(
    new Set(hydrated.map((p) => p.quoted_post_id).filter((id): id is string => !!id)),
  );
  if (!quotedIds.length) return hydrated;

  const { data: quotedRows, error } = await supabase
    .from("posts")
    .select(POST_COLS)
    .in("id", quotedIds);
  if (error) throw new Error(error.message);
  const quotedHydrated = await hydratePosts(supabase, quotedRows ?? [], { shallow: true });
  const quotedById = new Map(quotedHydrated.map((p) => [p.id, p]));
  return hydrated.map((p) =>
    p.quoted_post_id ? { ...p, quoted_post: quotedById.get(p.quoted_post_id) ?? null } : p,
  );
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
  "id, author_id, tribe_id, audience, content, image_url, tag, likes_count, replies_count, shares_count, reposts_count, quoted_post_id, created_at";

const COMMENT_COLS = "id, post_id, author_id, content, created_at, parent_id, mentions";

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
/**
 * Reposts never create a post - they're a row in `reposts` that bumps a
 * count and (via a DB trigger) notifies the author. To make one show up in
 * the feed "as if" it were a new item, this merges the tribe/global posts
 * query above with a second query joining `reposts -> posts`, filtered to
 * exactly the same audience/tribe_id the primary query already enforces, so
 * a tribe-only repost stays confined to that one tribe's feed exactly like
 * a tribe-only post already is. RLS on `posts` is what actually prevents a
 * repost of a tribe-only post from ever reaching a non-member's request in
 * the first place (the `posts!inner` join drops rows the caller can't read)
 * - the filter below is only about which of the *visible* feed a repost
 * belongs in, not a substitute for that.
 */
export const listFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tribe_id: z.enum(TRIBE_IDS).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let postsQuery = supabase
      .from("posts")
      .select(POST_COLS)
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.tribe_id) {
      postsQuery = postsQuery.eq("tribe_id", data.tribe_id).eq("audience", "tribe");
    } else {
      postsQuery = postsQuery.eq("audience", "all");
    }

    const repostsQuery = supabase
      .from("reposts")
      .select(`user_id, created_at, posts!inner(${POST_COLS})`)
      .order("created_at", { ascending: false })
      .limit(200);

    const [{ data: postRows, error: postsError }, { data: repostRows, error: repostsError }] =
      await Promise.all([postsQuery, repostsQuery]);
    if (postsError) throw new Error(postsError.message);
    if (repostsError) throw new Error(repostsError.message);

    type RepostRow = { user_id: string; created_at: string; posts: Record<string, unknown> };
    const scopedReposts = ((repostRows ?? []) as RepostRow[]).filter((r) =>
      data.tribe_id
        ? r.posts.tribe_id === data.tribe_id && r.posts.audience === "tribe"
        : r.posts.audience === "all",
    );

    const reposterIds = Array.from(new Set(scopedReposts.map((r) => r.user_id)));
    const reposters = new Map<string, AuthorLite>();
    if (reposterIds.length) {
      const { data: reposterRows, error: reposterError } = await supabase
        .from("profiles")
        .select(AUTHOR_COLS)
        .in("id", reposterIds);
      if (reposterError) throw new Error(reposterError.message);
      for (const a of (reposterRows ?? []) as AuthorLite[]) reposters.set(a.id, a);
    }

    // One entry per post id, never two - a repost of a post that's already
    // in `postRows` (the normal case: you can only repost something you can
    // already see) used to add a *second* copy of the same row, which broke
    // React's key uniqueness for every list keyed on post id. `scopedReposts`
    // is already ordered newest-first, so the first repost seen per post id
    // here is the most recent one - that's the one that gets to bump the
    // post's position and claim the "reposted by" attribution.
    const latestRepostByPostId = new Map<string, RepostRow>();
    for (const r of scopedReposts) {
      const postId = r.posts.id as string;
      if (!latestRepostByPostId.has(postId)) latestRepostByPostId.set(postId, r);
    }

    const rowsById = new Map<string, Record<string, unknown>>();
    for (const row of (postRows ?? []) as Record<string, unknown>[]) {
      rowsById.set(row.id as string, row);
    }
    for (const r of scopedReposts) {
      const postId = r.posts.id as string;
      if (!rowsById.has(postId)) rowsById.set(postId, r.posts);
    }

    const merged = Array.from(rowsById.values())
      .map((row) => {
        const repost = latestRepostByPostId.get(row.id as string);
        return {
          sortAt: (repost?.created_at ?? row.created_at) as string,
          row,
          repostedBy: repost ? (reposters.get(repost.user_id) ?? null) : null,
        };
      })
      .sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1))
      .slice(0, 200);

    const hydrated = await hydratePosts(
      supabase,
      merged.map((m) => m.row),
    );
    return hydrated.map((post, index) => ({ ...post, reposted_by: merged[index].repostedBy }));
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
  .inputValidator((input: unknown) => z.object({ author_id: z.string().uuid() }).parse(input))
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

// Backs the profile's "Reposts" tab - everything this viewer has reposted,
// hydrated the same way the feed is. Named distinctly from social.functions'
// listMyReposts (which returns bare post ids for the toggle-state Set, the
// same split saves already use between listMySavedIds/listMySavedPosts).
// Not merged into listMyPosts: a repost never becomes a post of yours, so it
// belongs in its own history, not mixed into "your posts."
export const listMyRepostedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("reposts")
      .select(`created_at, posts!inner(${POST_COLS})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const postRows = ((rows ?? []) as Array<{ posts: Record<string, unknown> }>).map(
      (r) => r.posts,
    );
    return hydratePosts(supabase, postRows);
  });

const imagePathSchema = z.string().regex(POST_IMAGE_PATH, "Invalid post image path").max(200);

const createSchema = z.object({
  tribe_id: z.string().min(1).max(40),
  content: z.string().max(500).default(""),
  image_paths: z.array(imagePathSchema).max(10).optional().default([]),
  tag: z.string().max(40).nullable().optional(),
  audience: z.enum(["tribe", "all"]).default("tribe"),
  mentions: z.array(z.string().uuid()).max(20).optional().default([]),
  quoted_post_id: z.string().uuid().optional(),
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // A quote's substance is the post it quotes - bare commentary-free
    // quoting (Twitter/Threads both allow this) shouldn't need padding text.
    if (!data.content.trim() && data.image_paths.length === 0 && !data.quoted_post_id) {
      throw new Error("Post can't be empty");
    }
    for (const path of data.image_paths) {
      if (!path.startsWith(`${userId}/`)) {
        throw new Error("Post images must belong to the author");
      }
    }

    // A quote can never be *wider* than the post it quotes - quoting a
    // tribe-only post must not be a way to re-broadcast it to "everyone".
    // Quoting an "everyone" post is unrestricted, since that content is
    // already visible to anyone.
    if (data.quoted_post_id) {
      const { data: quoted, error: quotedError } = await supabase
        .from("posts")
        .select("id, tribe_id, audience")
        .eq("id", data.quoted_post_id)
        .maybeSingle();
      if (quotedError) throw new Error(quotedError.message);
      if (!quoted) throw new Error("The post you're quoting is no longer available");
      if (
        quoted.audience === "tribe" &&
        (data.audience !== "tribe" || data.tribe_id !== quoted.tribe_id)
      ) {
        throw new Error("A Tribe-only post can only be quoted within that same Tribe");
      }
    }

    const coverImage = data.image_paths[0] ?? null;
    let result = await supabase
      .from("posts")
      .insert({
        author_id: userId,
        tribe_id: data.tribe_id,
        content: data.content,
        image_url: coverImage,
        tag: data.tag ?? null,
        audience: data.audience,
        mentions: data.mentions,
        quoted_post_id: data.quoted_post_id ?? null,
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
          image_url: coverImage,
          tag: data.tag ?? null,
          audience: data.audience,
        })
        .select(POST_COLS)
        .single();
    }
    const { data: row, error } = result;
    if (error) throw new Error(error.message);
    if (data.image_paths.length > 0) {
      const { error: imgError } = await supabase.rpc("set_post_images", {
        _post_id: row.id,
        _paths: data.image_paths,
      });
      if (imgError) throw new Error(imgError.message);
    }
    return (await hydratePosts(supabase, [row]))[0];
  });

const editSchema = z.object({
  id: z.string().uuid(),
  content: z.string().max(500),
  image_paths: z.array(imagePathSchema).max(10).optional(),
});

export const editPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => editSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (const path of data.image_paths ?? []) {
      if (!path.startsWith(`${userId}/`)) {
        throw new Error("Post images must belong to the author");
      }
    }
    const patch: { content: string; image_url?: string | null } = { content: data.content };
    if (data.image_paths !== undefined) patch.image_url = data.image_paths[0] ?? null;
    const { data: row, error } = await supabase
      .from("posts")
      .update(patch)
      .eq("id", data.id)
      .select(POST_COLS)
      .single();
    if (error) throw new Error(error.message);
    if (data.image_paths !== undefined) {
      const { error: imgError } = await supabase.rpc("set_post_images", {
        _post_id: data.id,
        _paths: data.image_paths,
      });
      if (imgError) throw new Error(imgError.message);
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await attachAuthors(supabase, newestWindow as any)) as CommentRow[];
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        post_id: z.string().uuid(),
        content: z.string().min(1).max(500),
        parent_id: z.string().uuid().nullable().optional(),
        mentions: z.array(z.string().uuid()).max(20).optional(),
      })
      .parse(input),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [withAuthor] = await attachAuthors(supabase, [row as any]);
    return {
      ...(withAuthor as CommentRow),
      replies_count: await getRepliesCount(supabase, data.post_id),
    };
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
    const { data: rows, error: e2 } = await supabase.from("posts").select(POST_COLS).in("id", ids);
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

// For a post's author removing someone else's comment on their own post -
// a hide, not a delete, so it's reversible and moderators still see it. The
// RPC itself enforces post ownership; this is not a stub of that check.
export const hideComment = createServerFn({ method: "POST" })
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
    const { error } = await supabase.rpc("hide_own_post_comment", { _comment_id: data.id });
    if (error) throw new Error(error.message);
    return { id: data.id, post_id: postId };
  });

// Only surfaces comments this viewer hid themselves - the RPC scopes it
// that way (moderation_hidden_by = auth.uid()), not "every hidden comment
// on my post," since a moderator's hide isn't the post owner's to review
// or reverse.
export const listHiddenComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("list_hidden_comments_on_my_post", {
      _post_id: data.post_id,
    });
    if (error) throw new Error(error.message);
    return (await attachAuthors(supabase, rows ?? [])) as CommentRow[];
  });

export const unhideComment = createServerFn({ method: "POST" })
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
    const { error } = await supabase.rpc("unhide_own_post_comment", { _comment_id: data.id });
    if (error) throw new Error(error.message);
    return { id: data.id, post_id: postId };
  });
