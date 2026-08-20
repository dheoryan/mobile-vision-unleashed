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
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.user_id ?? userId;
    const [{ count: following }, { count: followers }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", target),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followee_id", target),
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

export type BlockedProfile = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string;
  avatar_url: string | null;
};

/** Real profile info for everyone the current user has blocked, for the Settings UI. */
export const listMyBlockedProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: blockRows, error: blockError } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);
    if (blockError) throw new Error(blockError.message);
    const ids = (blockRows ?? []).map((r: { blocked_id: string }) => r.blocked_id);
    if (ids.length === 0) return [] as BlockedProfile[];

    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_emoji, avatar_url")
      .in("id", ids);
    if (error) throw new Error(error.message);
    return (rows ?? []) as BlockedProfile[];
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

// Re-export notification types for backwards compatibility
export type { NotificationRow as DerivedNotif } from "@/lib/notifications.functions";
export { listMyNotifications } from "@/lib/notifications.functions";
