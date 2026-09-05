import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  editMessage,
  getProfileById,
  listMessages,
  listThreads,
  markThreadRead,
  sendMessage,
  sharePostToDM,
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
      const replyTo = input.reply_to_id
        ? (current.find((message) => message.id === input.reply_to_id) ?? null)
        : null;
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
        reply_to: replyTo,
        edited_at: null,
        deleted_at: null,
        shared_post_id: null,
        reactions: emptyChatReactions(),
        my_reactions: [],
      };
      qc.setQueryData<DMMessage[]>(threadKey, [...current, optimistic]);
      return { tempId, replyTo };
    },
    onSuccess: (saved, _v, ctx) => {
      // sendMessage's response is the raw inserted row - it has
      // reply_to_id but not the joined reply_to preview (only the list
      // endpoint does that join). Carrying forward what onMutate already
      // resolved from local state avoids a real flicker: the quote would
      // otherwise show correctly while "sending…" and then disappear the
      // instant the send actually confirms, only reappearing on the next
      // poll.
      qc.setQueryData<DMMessage[]>(threadKey, (cur) =>
        (cur ?? []).map((m) =>
          m.id === ctx?.tempId ? { ...saved, reply_to: ctx?.replyTo ?? null } : m,
        ),
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

/** Fire-and-forget from wherever the share sheet is opened (a post's own
 *  screen, not necessarily the target thread) - just invalidates so the
 *  target thread and chat list pick the new message up next time they're
 *  viewed, rather than trying to optimistically patch a cache the sharer
 *  probably isn't looking at. */
export function useSharePostToDM() {
  const fn = useServerFn(sharePostToDM);
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: {
      recipient_id: string;
      post_id: string;
      request_id: string;
      caption?: string | null;
    }) => fn({ data: input }),
    onSuccess: (_saved, input) => {
      qc.invalidateQueries({ queryKey: THREADS_KEY });
      qc.invalidateQueries({ queryKey: THREAD_KEY(user?.id ?? "anonymous", input.recipient_id) });
      // The message insert and share event commit together in Postgres.
      // Refresh both feed and focused-post caches with the new total.
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["shared-post"] });
    },
  });
}

/** Patches one message's fields across whatever thread cache currently
 *  holds it, returning that message's pre-patch fields (from wherever it
 *  was first found) so a caller can undo just this one patch later.
 *
 *  Deliberately does NOT snapshot/restore the whole array the way this used
 *  to: a full-array rollback on a bulk action (multi-select unsend fires
 *  several of these concurrently) would restore every cache to its
 *  pre-batch state the moment any *one* of them failed, silently undoing
 *  every other message's already-applied - and possibly already
 *  server-confirmed - change in the same batch. Restoring only the single
 *  id a call actually touched, via this same "map and replace by id"
 *  shape, makes concurrent calls independent of each other regardless of
 *  timing. Same fix already applied to Tribe chat's unsendMessage
 *  (TribeScreen.tsx) after this exact bug was found there first. */
function patchMessageEverywhere(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<DMMessage>,
): DMMessage | undefined {
  let previous: DMMessage | undefined;
  const snapshots = qc.getQueriesData<DMMessage[]>({ queryKey: ["messages", "thread"] });
  for (const [key, data] of snapshots) {
    if (!data) continue;
    qc.setQueryData<DMMessage[]>(
      key,
      data.map((m) => {
        if (m.id !== id) return m;
        previous ??= m;
        return { ...m, ...patch };
      }),
    );
  }
  return previous;
}

export function useEditMessage() {
  const fn = useServerFn(editMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; content: string }) => fn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["messages", "thread"] });
      const previous = patchMessageEverywhere(qc, input.id, {
        content: input.content,
        edited_at: new Date().toISOString(),
      });
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) patchMessageEverywhere(qc, input.id, context.previous);
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
      const previous = patchMessageEverywhere(qc, id, {
        content: null,
        attachment_url: null,
        attachment_type: null,
        deleted_at: new Date().toISOString(),
      });
      return { previous, id };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) patchMessageEverywhere(qc, context.id, context.previous);
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
