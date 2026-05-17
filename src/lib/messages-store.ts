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

type ReadMap = Record<string, string>;

const EMPTY_READ_MAP: ReadMap = {};
const readListeners = new Set<() => void>();
let readSnapshot: ReadMap = readMapFromStorage();

function readMapFromStorage(): ReadMap {
  if (typeof window === "undefined") return EMPTY_READ_MAP;
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    if (!raw) return EMPTY_READ_MAP;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return EMPTY_READ_MAP;
    }
    return parsed as ReadMap;
  } catch {
    return EMPTY_READ_MAP;
  }
}

function sameReadMap(a: ReadMap, b: ReadMap): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

function persistRead(m: ReadMap) {
  if (sameReadMap(readSnapshot, m)) return;
  readSnapshot = m;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(m));
  } catch {
    /* no-op */
  }
  readListeners.forEach((l) => l());
}
function subscribeRead(l: () => void) {
  readListeners.add(l);
  return () => readListeners.delete(l);
}
function getReadSnapshot() {
  return readSnapshot;
}
function getReadServerSnapshot(): ReadMap {
  return EMPTY_READ_MAP;
}

function useReadMap(): ReadMap {
  return useSyncExternalStore(subscribeRead, getReadSnapshot, getReadServerSnapshot);
}

/** Sums unread messages across threads, respecting per-thread read cursors (reactive). */
export function useUnreadCount(threads: DMThreadSummary[] | undefined): number {
  const map = useReadMap();
  if (!threads?.length) return 0;
  let total = 0;
  for (const t of threads) {
    const cursor = map[t.other_id];
    if (!cursor || t.last_message.created_at > cursor) {
      total += t.unread_count;
    }
  }
  return total;
}

/** Non-reactive fallback (kept for compatibility). Prefer useUnreadCount in components. */
export function unreadFromThreads(threads: DMThreadSummary[] | undefined): number {
  if (!threads?.length) return 0;
  let total = 0;
  for (const t of threads) {
    const cursor = readSnapshot[t.other_id];
    if (!cursor || t.last_message.created_at > cursor) {
      total += t.unread_count;
    }
  }
  return total;
}

export function markThreadRead(otherId: string, lastTs: string) {
  if (readSnapshot[otherId] === lastTs) return;
  persistRead({ ...readSnapshot, [otherId]: lastTs });
}

export type { DMMessage, DMThreadSummary };
