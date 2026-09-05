import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getFollowCounts,
  getProfileStats,
  listMyFollowing,
  listMyLikes,
  listMyReposts,
  reportContent,
  toggleFollow,
  toggleLike,
  toggleRepost,
  recordShare,
  listIncomingHellos,
  listOutgoingHellos,
  listMyMootProfiles,
  getContactStatus,
  sendHello,
  answerHello,
  cancelHello,
} from "@/lib/social.functions";
import { useAuth } from "@/lib/auth-context";
import type { FeedPost } from "@/lib/posts.functions";

const LIKES_KEY = ["social", "likes"] as const;
const REPOSTS_KEY = ["social", "reposts"] as const;
const FOLLOWING_KEY = ["social", "following"] as const;
const FOLLOW_COUNTS_KEY = ["social", "follow-counts"] as const;
const PROFILE_STATS_KEY = ["social", "profile-stats"] as const;

export function useMyLikes() {
  const fn = useServerFn(listMyLikes);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...LIKES_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
    select: (rows) => new Set(rows),
  });
}

export function useMyFollowing() {
  const fn = useServerFn(listMyFollowing);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...FOLLOWING_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
    select: (rows) => new Set(rows),
  });
}

export function useFollowCounts() {
  const fn = useServerFn(getFollowCounts);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...FOLLOW_COUNTS_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/**
 * Moots / Hosted / Joined for the profile stat row.
 * Omit `userId` (or pass `undefined`) for your own profile. Pass `null`
 * explicitly while a target profile is still loading, so this doesn't fall
 * back to fetching your own stats in the gap before that id is known.
 */
export function useProfileStats(userId?: string | null) {
  const fn = useServerFn(getProfileStats);
  const { user } = useAuth();
  const target = userId === undefined ? user?.id : userId;
  return useQuery({
    queryKey: [...PROFILE_STATS_KEY, target ?? null],
    queryFn: () => fn({ data: { user_id: target! } }),
    enabled: !!target,
    staleTime: 30_000,
  });
}

/**
 * Compatibility shape for legacy `useSocial()` callers.
 * Returns `{ liked, following }` as Sets, populated from the server.
 */
export function useSocial() {
  const likes = useMyLikes();
  const following = useMyFollowing();
  return {
    liked: likes.data ?? new Set<string>(),
    following: following.data ?? new Set<string>(),
  };
}

type CountField = "likes_count" | "shares_count" | "reposts_count";

function isCountedPost(value: unknown, postId: string, field: CountField): value is FeedPost {
  return (
    !!value && typeof value === "object" && (value as FeedPost).id === postId && field in value
  );
}

/**
 * Walks every cached query - not just the `["posts"]`-prefixed feed lists -
 * and patches any that hold this post, whether as an array (a feed) or a
 * single object (the Signal Thread page's own `["shared-post", ...]`
 * query). Scoping this to `["posts"]` only used to mean liking/reposting/
 * sharing a post from its own focused page never updated until a manual
 * refresh, since that page's query lives under a different top-level key
 * entirely.
 */
function patchFeedCount(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  field: CountField,
  delta: number,
) {
  qc.setQueriesData<FeedPost[] | FeedPost>(
    {
      predicate: (query) => {
        const data = query.state.data;
        if (Array.isArray(data)) return data.some((p) => isCountedPost(p, postId, field));
        return isCountedPost(data, postId, field);
      },
    },
    (data) => {
      if (!data) return data;
      const bump = (p: FeedPost) => ({ ...p, [field]: Math.max((p[field] ?? 0) + delta, 0) });
      return Array.isArray(data) ? data.map((p) => (p.id === postId ? bump(p) : p)) : bump(data);
    },
  );
}

function reconcileFeedCount(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  field: CountField,
  value: number,
) {
  qc.setQueriesData<FeedPost[] | FeedPost>(
    {
      predicate: (query) => {
        const data = query.state.data;
        if (Array.isArray(data)) return data.some((p) => isCountedPost(p, postId, field));
        return isCountedPost(data, postId, field);
      },
    },
    (data) => {
      if (!data) return data;
      const set = (p: FeedPost) => ({ ...p, [field]: Math.max(value, 0) });
      return Array.isArray(data) ? data.map((p) => (p.id === postId ? set(p) : p)) : set(data);
    },
  );
}

export function useToggleLike() {
  const fn = useServerFn(toggleLike);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...LIKES_KEY, user?.id ?? null];
  return useMutation({
    mutationFn: (postId: string) => fn({ data: { post_id: postId } }),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      const wasLiked = prev.includes(postId);
      const next = wasLiked ? prev.filter((id) => id !== postId) : [...prev, postId];
      qc.setQueryData(key, next);
      patchFeedCount(qc, postId, "likes_count", wasLiked ? -1 : 1);
      return { prev, wasLiked, postId };
    },
    onError: (_e, _i, ctx) => {
      if (!ctx) return;
      qc.setQueryData(key, ctx.prev);
      patchFeedCount(qc, ctx.postId, "likes_count", ctx.wasLiked ? 1 : -1);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: LIKES_KEY });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onSuccess: (result) => {
      qc.setQueryData<string[]>(key, (cur) => {
        const rows = cur ?? [];
        return result.liked
          ? Array.from(new Set([...rows, result.post_id]))
          : rows.filter((id) => id !== result.post_id);
      });
      reconcileFeedCount(qc, result.post_id, "likes_count", result.likes_count);
    },
  });
}

export function useRecordShare() {
  const fn = useServerFn(recordShare);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { post_id: string; request_id: string; channel: "native" | "clipboard" }) =>
      fn({ data: input }),
    retry: 1, // Reuses the same request id; a network retry cannot double count.
    onSuccess: (result) =>
      reconcileFeedCount(qc, result.post_id, "shares_count", result.shares_count),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["posts"] });
      void qc.invalidateQueries({ queryKey: ["shared-post"] });
    },
  });
}

export function useMyReposts() {
  const fn = useServerFn(listMyReposts);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...REPOSTS_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
    select: (rows) => new Set(rows),
  });
}

export function useToggleRepost() {
  const fn = useServerFn(toggleRepost);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...REPOSTS_KEY, user?.id ?? null];
  return useMutation({
    mutationFn: ({ postId, audience }: { postId: string; audience: "tribe" | "all" }) =>
      fn({ data: { post_id: postId, audience } }),
    onMutate: async ({ postId }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      const wasReposted = prev.includes(postId);
      const next = wasReposted ? prev.filter((id) => id !== postId) : [...prev, postId];
      qc.setQueryData(key, next);
      patchFeedCount(qc, postId, "reposts_count", wasReposted ? -1 : 1);
      return { prev, wasReposted, postId };
    },
    onError: (_e, _i, ctx) => {
      if (!ctx) return;
      qc.setQueryData(key, ctx.prev);
      patchFeedCount(qc, ctx.postId, "reposts_count", ctx.wasReposted ? 1 : -1);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: REPOSTS_KEY });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onSuccess: (result) => {
      qc.setQueryData<string[]>(key, (cur) => {
        const rows = cur ?? [];
        return result.reposted
          ? Array.from(new Set([...rows, result.post_id]))
          : rows.filter((id) => id !== result.post_id);
      });
      reconcileFeedCount(qc, result.post_id, "reposts_count", result.reposts_count);
    },
  });
}

export function useToggleFollow() {
  const fn = useServerFn(toggleFollow);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...FOLLOWING_KEY, user?.id ?? null];
  const countsKey = [...FOLLOW_COUNTS_KEY, user?.id ?? null];
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { user_id: userId } }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: key });
      await qc.cancelQueries({ queryKey: countsKey });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      const prevCounts = qc.getQueryData<{ following: number; followers: number }>(countsKey);
      const wasFollowing = prev.includes(userId);
      qc.setQueryData(key, wasFollowing ? prev.filter((id) => id !== userId) : [...prev, userId]);
      if (prevCounts) {
        qc.setQueryData(countsKey, {
          ...prevCounts,
          following: Math.max(prevCounts.following + (wasFollowing ? -1 : 1), 0),
        });
      }
      return { prev, prevCounts, wasFollowing, userId };
    },
    onError: (_e, _i, ctx) => {
      if (!ctx) return;
      qc.setQueryData(key, ctx.prev);
      if (ctx.prevCounts) qc.setQueryData(countsKey, ctx.prevCounts);
    },
    onSuccess: (result) => {
      qc.setQueryData<string[]>(key, (cur) => {
        const rows = cur ?? [];
        return result.following
          ? Array.from(new Set([...rows, result.user_id]))
          : rows.filter((id) => id !== result.user_id);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: FOLLOWING_KEY });
      qc.invalidateQueries({ queryKey: FOLLOW_COUNTS_KEY });
    },
  });
}

export function useReportContent() {
  const fn = useServerFn(reportContent);
  return useMutation({
    mutationFn: (input: {
      target_kind: "post" | "user" | "comment";
      target_id: string;
      reason: string;
      details?: string;
    }) => fn({ data: input }),
  });
}

// ---------- Hellos ----------

const HELLOS_INCOMING_KEY = ["social", "hellos", "incoming"] as const;
const HELLOS_OUTGOING_KEY = ["social", "hellos", "outgoing"] as const;
const CONTACT_STATUS_KEY = ["social", "contact-status"] as const;

/** Everyone the current user is Moots with, for "N of your Moots are here"
 *  signals (e.g. the Tribe preview in Discover). */
export function useMyMoots() {
  const fn = useServerFn(listMyMootProfiles);
  const { user } = useAuth();
  return useQuery({
    queryKey: ["social", "moots", user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/** Hellos waiting on this user's answer. */
export function useIncomingHellos() {
  const fn = useServerFn(listIncomingHellos);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HELLOS_INCOMING_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/** Hellos this user sent that nobody's answered yet. */
export function useOutgoingHellos() {
  const fn = useServerFn(listOutgoingHellos);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HELLOS_OUTGOING_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/**
 * Whether the current user can DM this person, and if not, where a Hello
 * between them stands. Decides which action the profile screen offers.
 */
export function useContactStatus(otherId: string | null) {
  const fn = useServerFn(getContactStatus);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...CONTACT_STATUS_KEY, user?.id ?? null, otherId],
    queryFn: () => fn({ data: { other_id: otherId! } }),
    enabled: !!user && !!otherId && otherId !== user?.id,
    staleTime: 30_000,
  });
}

export function useSendHello() {
  const fn = useServerFn(sendHello);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { recipient_id: string; message: string }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTACT_STATUS_KEY });
      qc.invalidateQueries({ queryKey: HELLOS_OUTGOING_KEY });
    },
  });
}

export function useCancelHello() {
  const fn = useServerFn(cancelHello);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { hello_id: string }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HELLOS_OUTGOING_KEY });
      qc.invalidateQueries({ queryKey: CONTACT_STATUS_KEY });
    },
  });
}

export function useAnswerHello() {
  const fn = useServerFn(answerHello);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { hello_id: string; status: "accepted" | "declined" }) =>
      fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HELLOS_INCOMING_KEY });
      qc.invalidateQueries({ queryKey: CONTACT_STATUS_KEY });
      // Accepting opens a real thread, so the inbox changes too.
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
