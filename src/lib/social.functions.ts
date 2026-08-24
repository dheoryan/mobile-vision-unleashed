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
    const { data, error } = await supabase.from("likes").select("post_id").eq("user_id", userId);
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
      return {
        post_id: data.post_id,
        liked: false,
        likes_count: await getPostCount(supabase, "likes", data.post_id),
      };
    }
    const { error } = await supabase
      .from("likes")
      .insert({ post_id: data.post_id, user_id: userId });
    if (error) throw new Error(error.message);
    return {
      post_id: data.post_id,
      liked: true,
      likes_count: await getPostCount(supabase, "likes", data.post_id),
    };
  });

// --- Shares ----------------------------------------------------------------

export const listMyShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("shares").select("post_id").eq("user_id", userId);
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
      return {
        post_id: data.post_id,
        shared: false,
        shares_count: await getPostCount(supabase, "shares", data.post_id),
      };
    }
    const { error } = await supabase
      .from("shares")
      .insert({ post_id: data.post_id, user_id: userId });
    if (error) throw new Error(error.message);
    return {
      post_id: data.post_id,
      shared: true,
      shares_count: await getPostCount(supabase, "shares", data.post_id),
    };
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
    z
      .object({
        target_kind: z.enum(["post", "user", "comment"]),
        target_id: z.string().min(1).max(200),
        reason: z.string().min(1).max(80),
        details: z.string().max(1000).optional(),
      })
      .parse(input),
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

// ---------- Hellos ----------

/**
 * A Hello is a single message request to someone you have no relationship with.
 *
 * The Global timeline is deliberately look-but-don't-touch: you can see, like
 * and comment on anyone's global post, but you cannot open a DM with them. That
 * protects against the main harassment vector in this category — until now any
 * authenticated user could DM any other with no relationship at all — but on its
 * own it would be a dead end, showing you someone and then hiding them. The
 * Hello is the release valve.
 *
 * One per direction, ever. Accept and a normal thread opens; decline and the
 * sender cannot retry. Making "no" final is the point. Sends are capped monthly
 * in the database so a Hello stays a deliberate act rather than a mail merge.
 */
export type HelloStatus = "pending" | "accepted" | "declined";

export type HelloRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  status: HelloStatus;
  created_at: string;
  decided_at: string | null;
};

export type HelloWithProfile = HelloRow & { other: BlockedProfile | null };

const HELLO_COLS = "id, sender_id, recipient_id, message, status, created_at, decided_at";

export const sendHello = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        recipient_id: z.string().uuid(),
        message: z.string().trim().min(1).max(280),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.recipient_id === userId) throw new Error("You can't send yourself a Hello.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;
    const { data: row, error } = await db
      .from("hellos")
      .insert({ sender_id: userId, recipient_id: data.recipient_id, message: data.message })
      .select(HELLO_COLS)
      .single();

    if (error) {
      // The unique constraint is the "one per direction, ever" rule.
      if ((error as { code?: string }).code === "23505") {
        throw new Error("You've already sent this person a Hello.");
      }
      throw new Error(error.message);
    }
    return row as HelloRow;
  });

export const answerHello = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        hello_id: z.string().uuid(),
        status: z.enum(["accepted", "declined"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;
    // RLS restricts UPDATE to the recipient, and the hellos_guard trigger
    // rejects answering something already answered.
    const { data: row, error } = await db
      .from("hellos")
      .update({ status: data.status })
      .eq("id", data.hello_id)
      .eq("recipient_id", userId)
      .select(HELLO_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as HelloRow;
  });

/** Hellos waiting on this user's answer, with the sender's profile attached. */
export const listIncomingHellos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HelloWithProfile[]> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;
    const { data: rows, error } = await db
      .from("hellos")
      .select(HELLO_COLS)
      .eq("recipient_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const hellos = (rows ?? []) as HelloRow[];
    if (!hellos.length) return [];

    const ids = Array.from(new Set(hellos.map((h) => h.sender_id)));
    const { data: profiles, error: pErr } = await db
      .from("profiles")
      .select("id, display_name, handle, avatar_emoji, avatar_url")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);

    const map = new Map<string, BlockedProfile>();
    for (const p of (profiles ?? []) as BlockedProfile[]) map.set(p.id, p);
    return hellos.map((h) => ({ ...h, other: map.get(h.sender_id) ?? null }));
  });

/**
 * Whether the current user may open a DM with someone, and if not, whether a
 * Hello is already in flight. Drives which action the profile screen offers.
 */
export type ContactStatus = {
  can_message: boolean;
  hello_status: HelloStatus | null;
  /** The request to answer when the other person initiated the pending Hello. */
  hello_id: string | null;
  /** True when the pending Hello is waiting on *this* user to answer. */
  awaiting_my_answer: boolean;
  hellos_left_this_month: number;
};

export const getContactStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ other_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ContactStatus> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;

    const { data: canMessage, error: cErr } = await db.rpc("can_direct_message", {
      _a: userId,
      _b: data.other_id,
    });
    if (cErr) throw new Error(cErr.message);

    const { data: helloRows, error: helloError } = await db
      .from("hellos")
      .select("id, status, sender_id, recipient_id, created_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${data.other_id}),` +
          `and(sender_id.eq.${data.other_id},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: false })
      .limit(2);
    if (helloError) throw new Error(helloError.message);

    // The schema is unique per direction, so two rows can exist for the same
    // pair. Prefer the relationship-bearing accepted row, then a request that
    // can still be answered, rather than letting maybeSingle() fail on a valid
    // two-direction history.
    const hello = (helloRows ?? [])
      .slice()
      .sort((a: { status: HelloStatus }, b: { status: HelloStatus }) => {
        const rank: Record<HelloStatus, number> = { accepted: 0, pending: 1, declined: 2 };
        return rank[a.status] - rank[b.status];
      })[0] as
      | {
          id: string;
          status: HelloStatus;
          sender_id: string;
          recipient_id: string;
        }
      | undefined;

    const { count } = await db
      .from("hellos")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId)
      .gte(
        "created_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      );

    const MONTHLY_CAP = 5;
    return {
      can_message: !!canMessage,
      hello_status: (hello?.status as HelloStatus | undefined) ?? null,
      hello_id: hello?.id ?? null,
      awaiting_my_answer: !!hello && hello.status === "pending" && hello.recipient_id === userId,
      hellos_left_this_month: Math.max(0, MONTHLY_CAP - (count ?? 0)),
    };
  });
