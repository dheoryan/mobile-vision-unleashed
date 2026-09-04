import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  editMessage,
  getProfileById,
  listMessages,
  listThreads,
  markThreadRead,
  sendMessage,
  unsendMessage,
  type DMMessage,
  type DMThreadSummary,
} from "@/lib/messages.functions";
import { useAuth } from "@/lib/auth-context";
import type { NotificationRow } from "@/lib/notifications.functions";
import { emptyChatReactions, type RichMessageInput } from "@/lib/chat";

const THREADS_KEY = ["messages", "threads"] as const;
const THREAD_KEY = (userId: string, id: string) => ["messages", "thread", userId, id] as const;
const PROFILE_KEY = (id: string) => ["profile-by-id", id] as const;
const NOTIFICATIONS_KEY = ["notifications"] as const;

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
  const { user } = useAuth();
  return useQuery({
    queryKey: THREAD_KEY(user?.id ?? "anonymous", otherId ?? "none"),
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
  const threadKey = THREAD_KEY(user?.id ?? "anonymous", otherId);
  return useMutation({
    mutationFn: (input: RichMessageInput) => fn({ data: { recipient_id: otherId, ...input } }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: threadKey });
      const tempId = `tmp-${Date.now()}`;
      const current = qc.getQueryData<DMMessage[]>(threadKey) ?? [];
      const optimistic: DMMessage = {
        id: tempId,
        sender_id: user?.id ?? "me",
        recipient_id: otherId,
        content: input.content ?? null,
        created_at: new Date().toISOString(),
        read_at: null,
        attachment_url: input.attachment_url ?? null,
        attachment_type: input.attachment_url ? "image" : null,
        reply_to_id: input.reply_to_id ?? null,
        reply_to: input.reply_to_id
          ? (current.find((message) => message.id === input.reply_to_id) ?? null)
          : null,
        edited_at: null,
        deleted_at: null,
        reactions: emptyChatReactions(),
        my_reactions: [],
      };
      qc.setQueryData<DMMessage[]>(threadKey, [...current, optimistic]);
      return { tempId };
    },
    onSuccess: (saved, _v, ctx) => {
      qc.setQueryData<DMMessage[]>(threadKey, (cur) =>
        (cur ?? []).map((m) => (m.id === ctx?.tempId ? saved : m)),
      );
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData<DMMessage[]>(threadKey, (cur) =>
        (cur ?? []).filter((m) => m.id !== ctx?.tempId),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: THREADS_KEY });
    },
  });
}

/** Patches one message's fields across whatever thread cache currently
 *  holds it, with a snapshot for rollback - shared by edit and unsend since
 *  both are "change this one message in place, everywhere it might be
 *  cached" operations. */
function patchMessageEverywhere(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<DMMessage>,
) {
  const snapshots = qc.getQueriesData<DMMessage[]>({ queryKey: ["messages", "thread"] });
  for (const [key, data] of snapshots) {
    if (!data) continue;
    qc.setQueryData<DMMessage[]>(
      key,
      data.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }
  return snapshots;
}

export function useEditMessage() {
  const fn = useServerFn(editMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; content: string }) => fn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["messages", "thread"] });
      const snapshots = patchMessageEverywhere(qc, input.id, {
        content: input.content,
        edited_at: new Date().toISOString(),
      });
      return { snapshots };
    },
    onError: (_error, _input, context) => {
      for (const [key, value] of context?.snapshots ?? []) qc.setQueryData(key, value);
    },
    onSuccess: (saved) => {
      patchMessageEverywhere(qc, saved.id, saved);
    },
  });
}

export function useUnsendMessage() {
  const fn = useServerFn(unsendMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["messages", "thread"] });
      const snapshots = patchMessageEverywhere(qc, id, {
        content: null,
        attachment_url: null,
        attachment_type: null,
        deleted_at: new Date().toISOString(),
      });
      return { snapshots };
    },
    onError: (_error, _id, context) => {
      for (const [key, value] of context?.snapshots ?? []) qc.setQueryData(key, value);
    },
    onSuccess: (saved) => {
      patchMessageEverywhere(qc, saved.id, saved);
    },
  });
}

/** Sums durable unread messages across threads. */
export function useUnreadCount(threads: DMThreadSummary[] | undefined): number {
  return threads?.reduce((total, thread) => total + thread.unread_count, 0) ?? 0;
}

export function unreadFromThreads(threads: DMThreadSummary[] | undefined): number {
  return threads?.reduce((total, thread) => total + thread.unread_count, 0) ?? 0;
}

export function useMarkThreadRead(otherId: string) {
  const fn = useServerFn(markThreadRead);
  const qc = useQueryClient();
  const { user } = useAuth();
  const threadKey = THREAD_KEY(user?.id ?? "anonymous", otherId);
  return useMutation({
    mutationFn: () => fn({ data: { other_id: otherId } }),
    onMutate: async () => {
      await Promise.all([
        qc.cancelQueries({ queryKey: THREADS_KEY }),
        qc.cancelQueries({ queryKey: threadKey }),
        qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY }),
      ]);
      const threadSnapshots = qc.getQueriesData<DMThreadSummary[]>({ queryKey: THREADS_KEY });
      const messageSnapshot = qc.getQueryData<DMMessage[]>(threadKey);
      const notificationSnapshots = qc.getQueriesData<NotificationRow[]>({
        queryKey: NOTIFICATIONS_KEY,
      });
      const readAt = new Date().toISOString();

      qc.setQueriesData<DMThreadSummary[]>({ queryKey: THREADS_KEY }, (threads) =>
        threads?.map((thread) =>
          thread.other_id === otherId ? { ...thread, unread_count: 0 } : thread,
        ),
      );
      qc.setQueryData<DMMessage[]>(threadKey, (messages) =>
        messages?.map((message) =>
          message.sender_id === otherId && !message.read_at
            ? { ...message, read_at: readAt }
            : message,
        ),
      );
      qc.setQueriesData<NotificationRow[]>({ queryKey: NOTIFICATIONS_KEY }, (notifications) =>
        notifications?.map((notification) =>
          notification.kind === "message" &&
          notification.actor_id === otherId &&
          notification.message_id &&
          !notification.read_at
            ? { ...notification, read_at: readAt }
            : notification,
        ),
      );

      return { threadSnapshots, messageSnapshot, notificationSnapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.threadSnapshots ?? []) qc.setQueryData(key, value);
      qc.setQueryData(threadKey, context?.messageSnapshot);
      for (const [key, value] of context?.notificationSnapshots ?? []) {
        qc.setQueryData(key, value);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: THREADS_KEY });
      qc.invalidateQueries({ queryKey: threadKey });
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export type { DMMessage, DMThreadSummary };
