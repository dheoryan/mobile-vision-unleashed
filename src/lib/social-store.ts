import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getFollowCounts,
  listMyFollowing,
  listMyLikes,
  listMyShares,
  reportContent,
  toggleFollow,
  toggleLike,
  toggleShare,
} from "@/lib/social.functions";
import { useAuth } from "@/lib/auth-context";
import type { FeedPost } from "@/lib/posts.functions";

const LIKES_KEY = ["social", "likes"] as const;
const SHARES_KEY = ["social", "shares"] as const;
const FOLLOWING_KEY = ["social", "following"] as const;
const FOLLOW_COUNTS_KEY = ["social", "follow-counts"] as const;

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

function patchFeedCount(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  field: "likes_count" | "shares_count",
  delta: number,
) {
  qc.getQueriesData<FeedPost[]>({ queryKey: ["posts"] }).forEach(([key, data]) => {
    if (!data || !Array.isArray(data)) return;
    if (!data.some((p) => p && typeof p === "object" && "id" in p && p.id === postId)) return;
    qc.setQueryData(
      key,
      data.map((p) =>
        p.id === postId ? { ...p, [field]: Math.max((p[field] ?? 0) + delta, 0) } : p,
      ),
    );
  });
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
  });
}

export function useMyShares() {
  const fn = useServerFn(listMyShares);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...SHARES_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
    select: (rows) => new Set(rows),
  });
}

export function useToggleShare() {
  const fn = useServerFn(toggleShare);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...SHARES_KEY, user?.id ?? null];
  return useMutation({
    mutationFn: (postId: string) => fn({ data: { post_id: postId } }),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      const wasShared = prev.includes(postId);
      const next = wasShared ? prev.filter((id) => id !== postId) : [...prev, postId];
      qc.setQueryData(key, next);
      patchFeedCount(qc, postId, "shares_count", wasShared ? -1 : 1);
      return { prev, wasShared, postId };
    },
    onError: (_e, _i, ctx) => {
      if (!ctx) return;
      qc.setQueryData(key, ctx.prev);
      patchFeedCount(qc, ctx.postId, "shares_count", ctx.wasShared ? 1 : -1);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: SHARES_KEY });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useToggleFollow() {
  const fn = useServerFn(toggleFollow);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...FOLLOWING_KEY, user?.id ?? null];
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { user_id: userId } }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      const wasFollowing = prev.includes(userId);
      qc.setQueryData(
        key,
        wasFollowing ? prev.filter((id) => id !== userId) : [...prev, userId],
      );
      return { prev };
    },
    onError: (_e, _i, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
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
