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

const AUTHOR_COLS = "id, display_name, handle, avatar_emoji, avatar_url, plan";

const uuidIn = z.object({ user_id: z.string().uuid() });
const postIn = z.object({ post_id: z.string().uuid() });

async function getPostCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: "likes" | "shares",
  postId: string,
) {
  const { count, error } = await supabase
    .from(table)
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// --- Likes -----------------------------------------------------------------

export const listMyLikes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { post_id: string }) => r.post_id);
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => postIn.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("likes")
      .select("post_id")
      .eq("post_id", data.post_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("post_id", data.post_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { post_id: data.post_id, liked: false, likes_count: await getPostCount(supabase, "likes", data.post_id) };
    }
    const { error } = await supabase
      .from("likes")
      .insert({ post_id: data.post_id, user_id: userId });
    if (error) throw new Error(error.message);
    return { post_id: data.post_id, liked: true, likes_count: await getPostCount(supabase, "likes", data.post_id) };
  });

// --- Shares ----------------------------------------------------------------

export const listMyShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("shares")
      .select("post_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { post_id: string }) => r.post_id);
  });

export const toggleShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => postIn.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("shares")
      .select("post_id")
      .eq("post_id", data.post_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("shares")
        .delete()
        .eq("post_id", data.post_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { post_id: data.post_id, shared: false, shares_count: await getPostCount(supabase, "shares", data.post_id) };
    }
    const { error } = await supabase
      .from("shares")
      .insert({ post_id: data.post_id, user_id: userId });
    if (error) throw new Error(error.message);
    return { post_id: data.post_id, shared: true, shares_count: await getPostCount(supabase, "shares", data.post_id) };
  });

export const listMyFollowing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { followee_id: string }) => r.followee_id);
  });

export const getFollowCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: following }, { count: followers }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followee_id", userId),
    ]);
    return { following: following ?? 0, followers: followers ?? 0 };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uuidIn.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("Can't follow yourself");
    const { data: existing } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", userId)
      .eq("followee_id", data.user_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("followee_id", data.user_id);
      if (error) throw new Error(error.message);
      return { user_id: data.user_id, following: false };
    }
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: userId, followee_id: data.user_id });
    if (error) throw new Error(error.message);
    return { user_id: data.user_id, following: true };
  });

// --- Blocks ----------------------------------------------------------------

export const listMyBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uuidIn.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("Can't block yourself");
    const { error } = await supabase
      .from("blocks")
      .upsert(
        { blocker_id: userId, blocked_id: data.user_id },
        { onConflict: "blocker_id,blocked_id" },
      );
    if (error) throw new Error(error.message);
    return { user_id: data.user_id };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uuidIn.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", data.user_id);
    if (error) throw new Error(error.message);
    return { user_id: data.user_id };
  });

// --- Reports ---------------------------------------------------------------

export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      target_kind: z.enum(["post", "user", "comment"]),
      target_id: z.string().min(1).max(200),
      reason: z.string().min(1).max(80),
      details: z.string().max(1000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_kind: data.target_kind,
      target_id: data.target_id,
      reason: data.reason,
      details: data.details ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Notifications (derived from real follows/likes/comments) -------------

export type DerivedNotif = {
  id: string;
  type: "like" | "comment" | "follow";
  actor: AuthorLite | null;
  post_id: string | null;
  comment_excerpt: string | null;
  created_at: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Get my post ids (for like/comment targeting)
    const { data: myPosts } = await supabase
      .from("posts")
      .select("id")
      .eq("author_id", userId);
    const myPostIds = (myPosts ?? []).map((p: { id: string }) => p.id);

    // 2. Likes on my posts (excluding self-likes)
    const likesP = myPostIds.length
      ? supabase
          .from("likes")
          .select("post_id, user_id, created_at")
          .in("post_id", myPostIds)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as Array<{ post_id: string; user_id: string; created_at: string }> });

    // 3. Comments on my posts (excluding mine)
    const commentsP = myPostIds.length
      ? supabase
          .from("comments")
          .select("id, post_id, author_id, content, created_at")
          .in("post_id", myPostIds)
          .neq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as Array<{ id: string; post_id: string; author_id: string; content: string; created_at: string }> });

    // 4. New followers
    const followsP = supabase
      .from("follows")
      .select("follower_id, created_at")
      .eq("followee_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);

    const [likesR, commentsR, followsR] = await Promise.all([likesP, commentsP, followsP]);

    const actorIds = new Set<string>();
    (likesR.data ?? []).forEach((r) => actorIds.add(r.user_id));
    (commentsR.data ?? []).forEach((r) => actorIds.add(r.author_id));
    (followsR.data ?? []).forEach((r) => actorIds.add(r.follower_id));

    const actorMap = new Map<string, AuthorLite>();
    if (actorIds.size) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select(AUTHOR_COLS)
        .in("id", [...actorIds]);
      for (const a of (profiles ?? []) as AuthorLite[]) actorMap.set(a.id, a);
    }

    const items: DerivedNotif[] = [];
    for (const r of likesR.data ?? []) {
      items.push({
        id: `like:${r.post_id}:${r.user_id}:${r.created_at}`,
        type: "like",
        actor: actorMap.get(r.user_id) ?? null,
        post_id: r.post_id,
        comment_excerpt: null,
        created_at: r.created_at,
      });
    }
    for (const r of commentsR.data ?? []) {
      items.push({
        id: `comment:${r.id}`,
        type: "comment",
        actor: actorMap.get(r.author_id) ?? null,
        post_id: r.post_id,
        comment_excerpt: r.content.slice(0, 80),
        created_at: r.created_at,
      });
    }
    for (const r of followsR.data ?? []) {
      items.push({
        id: `follow:${r.follower_id}:${r.created_at}`,
        type: "follow",
        actor: actorMap.get(r.follower_id) ?? null,
        post_id: null,
        comment_excerpt: null,
        created_at: r.created_at,
      });
    }

    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return items.slice(0, 60);
  });
