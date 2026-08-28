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

// Moots / Hosted / Joined replace Following / Followers / Posts on the profile
// stat row. All three need to work for someone else's profile, not just your
// own, and none of the three source tables (hellos, ventures,
// venture_applications) grant that under their existing RLS - see
// 20260828030000_profile_relationship_stats.sql for why this has to be an RPC
// rather than three direct table queries.
export type ProfileStats = { moots: number; hosted: number; joined: number };

export const getProfileStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ProfileStats> => {
    const { supabase, userId } = context;
    const target = data.user_id ?? userId;
    const { data: row, error } = await supabase
      .rpc("get_profile_stats", { _target_id: target })
      .single();
    if (error) throw new Error(error.message);
    const stats = row as { moots_count: number; hosted_count: number; joined_count: number };
    return { moots: stats.moots_count, hosted: stats.hosted_count, joined: stats.joined_count };
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
// "expired" only ever appears on a superseded row (see
// hellos_enforce_retry_window) - a retry after 30 days moves the stale
// pending row here instead of leaving two live rows for the same direction.
// "cancelled" is the sender withdrawing their own pending Hello - unlike a
// decline, it carries no 30-day cooldown and refunds the monthly cap.
export type HelloStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";

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
      // Retry timing, the monthly cap, and "already Moots" all raise as
      // plain Postgres exceptions from hellos_enforce_retry_window /
      // hellos_enforce_monthly_cap - error.message is already the right copy.
      // 23505 is only the defensive backstop against a concurrent double-send.
      if ((error as { code?: string }).code === "23505") {
        throw new Error("You already have a Hello pending with this person.");
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

/**
 * The sender withdrawing their own still-pending Hello. Unlike a decline,
 * this carries no 30-day cooldown (hellos_enforce_retry_window doesn't gate
 * on "cancelled" at all - a fresh send is allowed immediately) and refunds
 * the monthly cap (hellos_capped_sent_this_month excludes cancelled rows).
 */
export const cancelHello = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ hello_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;
    // RLS restricts this update to a participant, and hellos_guard rejects
    // anyone but the sender setting status to 'cancelled'.
    const { data: row, error } = await db
      .from("hellos")
      .update({ status: "cancelled" })
      .eq("id", data.hello_id)
      .eq("sender_id", userId)
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
 * Hellos this user sent that are still awaiting an answer, with the
 * recipient's profile attached. Read-only from the sender's side - the only
 * action available is cancelHello, not editing or re-sending in place.
 */
export const listOutgoingHellos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HelloWithProfile[]> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;
    const { data: rows, error } = await db
      .from("hellos")
      .select(HELLO_COLS)
      .eq("sender_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const hellos = (rows ?? []) as HelloRow[];
    if (!hellos.length) return [];

    const ids = Array.from(new Set(hellos.map((h) => h.recipient_id)));
    const { data: profiles, error: pErr } = await db
      .from("profiles")
      .select("id, display_name, handle, avatar_emoji, avatar_url")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);

    const map = new Map<string, BlockedProfile>();
    for (const p of (profiles ?? []) as BlockedProfile[]) map.set(p.id, p);
    return hellos.map((h) => ({ ...h, other: map.get(h.recipient_id) ?? null }));
  });

export type MootProfile = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string;
  avatar_url: string | null;
  tribe_ids: string[];
};

/**
 * Everyone the current user is Moots with (an accepted Hello, either
 * direction), with enough profile shape to show "N of your Moots are here"
 * signals elsewhere - e.g. the Tribe preview in Discover.
 */
export const listMyMootProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MootProfile[]> => {
    const { supabase, userId } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;

    const { data: rows, error } = await db
      .from("hellos")
      .select("sender_id, recipient_id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set(
        ((rows ?? []) as { sender_id: string; recipient_id: string }[]).map((r) =>
          r.sender_id === userId ? r.recipient_id : r.sender_id,
        ),
      ),
    );
    if (!ids.length) return [];

    const { data: profiles, error: pErr } = await db
      .from("profiles")
      .select("id, display_name, handle, avatar_emoji, avatar_url, tribe_ids")
      .in("id", ids);
    if (pErr) throw new Error(pErr.message);
    return (profiles ?? []) as MootProfile[];
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

    // A retry can leave several historical rows in one direction (an expired
    // or declined attempt before a fresh one), so this can no longer assume
    // at most one row per direction. 20 is generous headroom - retries are
    // gated 30 days apart, so that's years of history for either direction.
    const { data: helloRows, error: helloError } = await db
      .from("hellos")
      .select("id, status, sender_id, recipient_id, created_at, decided_at")
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${data.other_id}),` +
          `and(sender_id.eq.${data.other_id},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (helloError) throw new Error(helloError.message);

    type ContactHelloRow = {
      id: string;
      status: HelloStatus;
      sender_id: string;
      recipient_id: string;
      created_at: string;
      decided_at: string | null;
    };

    // Rows arrive newest-first, so the first row seen per sender is that
    // direction's current state; anything after it is superseded history.
    const latestByDirection = new Map<string, ContactHelloRow>();
    for (const row of (helloRows ?? []) as ContactHelloRow[]) {
      if (!latestByDirection.has(row.sender_id)) latestByDirection.set(row.sender_id, row);
    }

    // Prefer the relationship-bearing accepted row, then a request that can
    // still be answered, over a row from the direction that's gone quiet.
    // Cancelled behaves like expired here: it's the sender's own choice to
    // withdraw, so it shouldn't linger as a "current" state either - the
    // profile should offer Say hello again immediately, matching that a
    // cancel carries no retry cooldown.
    let hello: ContactHelloRow | undefined = Array.from(latestByDirection.values())
      .filter((row) => row.status !== "expired" && row.status !== "cancelled")
      .sort((a, b) => {
        const rank: Record<HelloStatus, number> = {
          accepted: 0,
          pending: 1,
          declined: 2,
          expired: 3,
          cancelled: 4,
        };
        return rank[a.status] - rank[b.status];
      })[0];

    // hellos_enforce_retry_window only expires a stale pending row when the
    // sender actually tries to retry (lazy, not on a schedule) - so a
    // 31-day-old unanswered/declined row can still be sitting here as
    // "current". If *this viewer* was the sender, treat it as gone so the
    // profile offers Say hello again instead of a stuck disabled button. A
    // recipient should always be able to answer an old pending request, so
    // this only ever unwraps the sender's own view.
    const RETRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    if (hello && hello.sender_id === userId) {
      const stalePending =
        hello.status === "pending" &&
        Date.now() - new Date(hello.created_at).getTime() >= RETRY_WINDOW_MS;
      const staleDecline =
        hello.status === "declined" &&
        !!hello.decided_at &&
        Date.now() - new Date(hello.decided_at).getTime() >= RETRY_WINDOW_MS;
      if (stalePending || staleDecline) hello = undefined;
    }

    // Same predicate the hellos_enforce_monthly_cap trigger enforces, so this
    // number never drifts from what actually gets rejected at send time:
    // Tribemates and active Venture co-members don't count against it.
    const { data: sentThisMonth, error: capError } = await db.rpc("hellos_capped_sent_this_month", {
      _user_id: userId,
    });
    if (capError) throw new Error(capError.message);

    const MONTHLY_CAP = 30;
    return {
      can_message: !!canMessage,
      hello_status: (hello?.status as HelloStatus | undefined) ?? null,
      hello_id: hello?.id ?? null,
      awaiting_my_answer: !!hello && hello.status === "pending" && hello.recipient_id === userId,
      hellos_left_this_month: Math.max(0, MONTHLY_CAP - (sentThisMonth ?? 0)),
    };
  });
