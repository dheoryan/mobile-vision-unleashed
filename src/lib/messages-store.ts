import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getProfileById,
  listMessages,
  listThreads,
  sendMessage,
  type DMMessage,
  type DMThreadSummary,
} from "@/lib/messages.functions";
import { useAuth } from "@/lib/auth-context";

const THREADS_KEY = ["messages", "threads"] as const;
const THREAD_KEY = (id: string) => ["messages", "thread", id] as const;
const PROFILE_KEY = (id: string) => ["profile-by-id", id] as const;

export function useThreads() {
  const fn = useServerFn(listThreads);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...THREADS_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });
}

export function useThreadMessages(otherId: string | null) {
  const fn = useServerFn(listMessages);
  return useQuery({
    queryKey: THREAD_KEY(otherId ?? "none"),
    queryFn: () => fn({ data: { other_id: otherId! } }),
    enabled: !!otherId,
    staleTime: 5_000,
    refetchInterval: 8_000,
  });
}

export function useProfileById(userId: string | null) {
  const fn = useServerFn(getProfileById);
  return useQuery({
    queryKey: PROFILE_KEY(userId ?? "none"),
    queryFn: () => fn({ data: { user_id: userId! } }),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useSendMessage(otherId: string) {
  const fn = useServerFn(sendMessage);
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (content: string) =>
      fn({ data: { recipient_id: otherId, content } }),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: THREAD_KEY(otherId) });
      const tempId = `tmp-${Date.now()}`;
      const optimistic: DMMessage = {
        id: tempId,
        sender_id: user?.id ?? "me",
        recipient_id: otherId,
        content,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<DMMessage[]>(THREAD_KEY(otherId), (cur) => [
        ...(cur ?? []),
        optimistic,
      ]);
      return { tempId };
    },
    onSuccess: (saved, _v, ctx) => {
      qc.setQueryData<DMMessage[]>(THREAD_KEY(otherId), (cur) =>
        (cur ?? []).map((m) => (m.id === ctx?.tempId ? saved : m)),
      );
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData<DMMessage[]>(THREAD_KEY(otherId), (cur) =>
        (cur ?? []).filter((m) => m.id !== ctx?.tempId),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: THREADS_KEY });
    },
  });
}

const READ_KEY = "mutuals.dm.read";

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function writeMap(m: Record<string, string>) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(m));
  } catch {
    /* no-op */
  }
}

/** Sums unread messages across threads, respecting per-thread read cursors in localStorage. */
export function unreadFromThreads(threads: DMThreadSummary[] | undefined): number {
  if (!threads?.length) return 0;
  const m = readMap();
  let total = 0;
  for (const t of threads) {
    const cursor = m[t.other_id];
    if (!cursor || t.last_message.created_at > cursor) {
      total += t.unread_count;
    }
  }
  return total;
}

export function markThreadRead(otherId: string, lastTs: string) {
  const m = readMap();
  if (m[otherId] === lastTs) return;
  m[otherId] = lastTs;
  writeMap(m);
}

export type { DMMessage, DMThreadSummary };
