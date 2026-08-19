import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { blockUser, listMyBlocks, listMyBlockedProfiles, unblockUser } from "@/lib/social.functions";
import { useAuth } from "@/lib/auth-context";

const BLOCKS_KEY = ["social", "blocks"] as const;
const BLOCKED_PROFILES_KEY = ["social", "blocked-profiles"] as const;

export function useBlocks() {
  const fn = useServerFn(listMyBlocks);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...BLOCKS_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
    select: (rows) => new Set(rows),
  });
}

/** Legacy compatibility: returns the Set<string> directly. */
export function useBlocked() {
  const q = useBlocks();
  return q.data ?? new Set<string>();
}

/** Real profile info (name/handle/avatar) for everyone the current user has blocked. */
export function useBlockedProfiles() {
  const fn = useServerFn(listMyBlockedProfiles);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...BLOCKED_PROFILES_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useBlockUser() {
  const fn = useServerFn(blockUser);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...BLOCKS_KEY, user?.id ?? null];
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { user_id: userId } }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      if (!prev.includes(userId)) qc.setQueryData(key, [...prev, userId]);
      return { prev };
    },
    onError: (_e, _i, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: BLOCKS_KEY });
      qc.invalidateQueries({ queryKey: BLOCKED_PROFILES_KEY });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useUnblockUser() {
  const fn = useServerFn(unblockUser);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = [...BLOCKS_KEY, user?.id ?? null];
  return useMutation({
    mutationFn: (userId: string) => fn({ data: { user_id: userId } }),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      qc.setQueryData(key, prev.filter((id) => id !== userId));
      return { prev };
    },
    onError: (_e, _i, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: BLOCKS_KEY });
      qc.invalidateQueries({ queryKey: BLOCKED_PROFILES_KEY });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
