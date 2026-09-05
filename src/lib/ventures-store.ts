import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import {
  applyToVenture,
  closeHostedVenture,
  updateHostedVenture,
  withdrawVentureApplication,
  reopenHostedVenture,
  createHostedVenture,
  decideVentureApplication,
  listMyHostedVentures,
  listMyJoinedVentures,
  listProfileVentureHistory,
  listOpenVentures,
  listVentureMessages,
  sendVentureMessage,
  editVentureMessage,
  unsendVentureMessage,
  getVentureCoordination,
  setVentureArrivalStatus,
  updateVentureAnnouncement,
  type VentureApplication,
  type VentureParty,
  type VentureScope,
  type VentureMessage,
  type VentureCoordination,
  type VentureArrivalStatus,
  type ProfileVentureHistoryItem,
} from "@/lib/ventures.functions";
import { emptyChatReactions, type RichMessageInput } from "@/lib/chat";

export type {
  VentureApplication,
  VentureParty,
  VentureScope,
  VentureMessage,
  VentureProfileLite,
  VentureCoordination,
  VentureArrivalStatus,
  VentureArrivalState,
  VentureAnnouncement,
  ProfileVentureHistoryItem,
} from "@/lib/ventures.functions";

const VENTURES_KEY = ["ventures"] as const;
const OPEN_KEY = ["ventures", "open"] as const;
const HOSTED_KEY = ["ventures", "hosted"] as const;
const JOINED_KEY = ["ventures", "joined"] as const;
const MESSAGES_KEY = (ventureId: string) => ["ventures", "messages", ventureId] as const;
const COORDINATION_KEY = (ventureId: string) => ["ventures", "coordination", ventureId] as const;

function invalidateVentures(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: VENTURES_KEY });
  qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useOpenVentures(scope: VentureScope) {
  const fn = useServerFn(listOpenVentures);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...OPEN_KEY, scope, user?.id ?? null],
    queryFn: () => fn({ data: { scope } }),
    enabled: !!user,
    staleTime: 10_000,
  });
}

export function useMyHostedVentures() {
  const fn = useServerFn(listMyHostedVentures);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...HOSTED_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 10_000,
  });
}

export function useMyJoinedVentures() {
  const fn = useServerFn(listMyJoinedVentures);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...JOINED_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 10_000,
  });
}

export function useProfileVentureHistory(profileId: string | null) {
  const fn = useServerFn(listProfileVentureHistory);
  return useQuery({
    queryKey: ["ventures", "profile-history", profileId],
    queryFn: () => fn({ data: { profile_id: profileId! } }),
    enabled: !!profileId,
    staleTime: 15_000,
  });
}

export function useCreateHostedVenture() {
  const fn = useServerFn(createHostedVenture);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      intents: string[];
      scope: VentureScope;
      /** Legacy free-text timing. Derived from the day the host picked. */
      time_window: string;
      starts_at: string;
      ends_at: string;
      /** IANA zone the Venture happens in, e.g. Asia/Jakarta. */
      venue_tz?: string | null;
      /** Becomes a venue_places row server-side; the caller has no id to send. */
      venue?: {
        google_place_id?: string | null;
        host_label: string;
        area?: string;
        latitude?: number | null;
        longitude?: number | null;
      } | null;
      /** Visible only to the host and accepted members. */
      private_venue?: { arrival_details: string } | null;
      note?: string;
      max_slots: number;
      /** Object path in the private venture-images bucket, not a URL. */
      image_url?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => {
      invalidateVentures(qc);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}

export function useApplyToVenture() {
  const fn = useServerFn(applyToVenture);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { venture_id: string; message?: string }) => fn({ data: input }),
    onSuccess: () => invalidateVentures(qc),
  });
}

export function useDecideVentureApplication() {
  const fn = useServerFn(decideVentureApplication);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { application_id: string; status: "accepted" | "declined" }) =>
      fn({ data: input }),
    onSuccess: () => invalidateVentures(qc),
  });
}

export function useCloseHostedVenture() {
  const fn = useServerFn(closeHostedVenture);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ventureId: string) => fn({ data: { venture_id: ventureId } }),
    onSuccess: () => invalidateVentures(qc),
  });
}

export function useUpdateHostedVenture() {
  const fn = useServerFn(updateHostedVenture);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      venture_id: string;
      title?: string;
      intents?: string[];
      scope?: VentureScope;
      time_window?: string;
      starts_at?: string | null;
      ends_at?: string | null;
      venue_tz?: string | null;
      /** Becomes a venue_places row server-side; the caller has no id to send. */
      venue?: {
        google_place_id?: string | null;
        host_label: string;
        area?: string;
        latitude?: number | null;
        longitude?: number | null;
      } | null;
      /** Visible only to the host and accepted members. */
      private_venue?: { arrival_details: string } | null;
      note?: string;
      max_slots?: number;
      image_url?: string | null;
    }) => fn({ data: input }),
    onSuccess: () => invalidateVentures(qc),
  });
}

export function useWithdrawVentureApplication() {
  const fn = useServerFn(withdrawVentureApplication);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: string) => fn({ data: { application_id: applicationId } }),
    onSuccess: () => invalidateVentures(qc),
  });
}

export function useReopenHostedVenture() {
  const fn = useServerFn(reopenHostedVenture);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ventureId: string) => fn({ data: { venture_id: ventureId } }),
    onSuccess: () => invalidateVentures(qc),
  });
}

export function useVentureMessages(ventureId: string | null, enabled = true) {
  const fn = useServerFn(listVentureMessages);
  const { user } = useAuth();
  return useQuery({
    queryKey: MESSAGES_KEY(ventureId ?? "none"),
    queryFn: () => fn({ data: { venture_id: ventureId! } }),
    enabled: !!user && !!ventureId && enabled,
    staleTime: 5_000,
    refetchInterval: 8_000,
  });
}

export function useVentureCoordination(ventureId: string | null, enabled = true) {
  const fn = useServerFn(getVentureCoordination);
  const { user } = useAuth();
  return useQuery({
    queryKey: COORDINATION_KEY(ventureId ?? "none"),
    queryFn: () => fn({ data: { venture_id: ventureId! } }),
    enabled: !!user && !!ventureId && enabled,
    staleTime: 5_000,
    refetchInterval: 12_000,
  });
}

export function useSetVentureArrivalStatus(ventureId: string) {
  const fn = useServerFn(setVentureArrivalStatus);
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (status: VentureArrivalStatus | null) =>
      fn({ data: { venture_id: ventureId, status } }),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: COORDINATION_KEY(ventureId) });
      const previous = qc.getQueryData<VentureCoordination>(COORDINATION_KEY(ventureId));
      if (previous && user?.id) {
        qc.setQueryData<VentureCoordination>(COORDINATION_KEY(ventureId), {
          ...previous,
          statuses: status
            ? [
                {
                  venture_id: ventureId,
                  user_id: user.id,
                  status,
                  updated_at: new Date().toISOString(),
                },
                ...previous.statuses.filter((item) => item.user_id !== user.id),
              ]
            : previous.statuses.filter((item) => item.user_id !== user.id),
        });
      }
      return { previous, status };
    },
    onError: (_error, _status, context) => {
      if (context?.previous) qc.setQueryData(COORDINATION_KEY(ventureId), context.previous);
    },
    onSuccess: (arrival) => {
      qc.setQueryData<VentureCoordination>(COORDINATION_KEY(ventureId), (current) => {
        if (!current) return current;
        const userId = arrival?.user_id ?? user?.id;
        if (!userId) return current;
        return {
          ...current,
          statuses: arrival
            ? [arrival, ...current.statuses.filter((item) => item.user_id !== userId)]
            : current.statuses.filter((item) => item.user_id !== userId),
        };
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: COORDINATION_KEY(ventureId) });
      qc.invalidateQueries({ queryKey: MESSAGES_KEY(ventureId) });
    },
  });
}

export function useUpdateVentureAnnouncement(ventureId: string) {
  const fn = useServerFn(updateVentureAnnouncement);
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (content: string | null) => fn({ data: { venture_id: ventureId, content } }),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: COORDINATION_KEY(ventureId) });
      const previous = qc.getQueryData<VentureCoordination>(COORDINATION_KEY(ventureId));
      if (previous) {
        qc.setQueryData<VentureCoordination>(COORDINATION_KEY(ventureId), {
          ...previous,
          announcement:
            content && user?.id
              ? {
                  venture_id: ventureId,
                  author_id: user.id,
                  content,
                  updated_at: new Date().toISOString(),
                }
              : null,
        });
      }
      return { previous };
    },
    onError: (_error, _content, context) => {
      if (context?.previous) qc.setQueryData(COORDINATION_KEY(ventureId), context.previous);
    },
    onSuccess: (announcement) => {
      qc.setQueryData<VentureCoordination>(COORDINATION_KEY(ventureId), (current) =>
        current ? { ...current, announcement } : current,
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: COORDINATION_KEY(ventureId) });
      qc.invalidateQueries({ queryKey: MESSAGES_KEY(ventureId) });
    },
  });
}

export function useSendVentureMessage(ventureId: string) {
  const fn = useServerFn(sendVentureMessage);
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = MESSAGES_KEY(ventureId);
  return useMutation({
    mutationFn: (input: RichMessageInput) => fn({ data: { venture_id: ventureId, ...input } }),
    // Mirrors useSendMessage's optimistic path (messages-store.ts) - Venture
    // chat was clearly built from that same component but never given the
    // matching mutation logic, so it sent with no immediate feedback while
    // DM felt instant, and MessagesPanel.tsx's "pending"/tmp- id UI for
    // Venture messages sat dead with nothing that could ever produce a
    // tmp- id. This also fixes a freshly-sent reply's quote never
    // appearing at all until the next poll, since sendVentureMessage's raw
    // response has reply_to_id but not the joined reply_to preview.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const tempId = `tmp-${Date.now()}`;
      const current = qc.getQueryData<VentureMessage[]>(key) ?? [];
      const replyTo = input.reply_to_id
        ? (current.find((message) => message.id === input.reply_to_id) ?? null)
        : null;
      const optimistic: VentureMessage = {
        id: tempId,
        venture_id: ventureId,
        sender_id: user?.id ?? "me",
        content: input.content ?? null,
        created_at: new Date().toISOString(),
        attachment_url: input.attachment_url ?? null,
        attachment_type: input.attachment_url ? "image" : null,
        reply_to_id: input.reply_to_id ?? null,
        mentions: input.mentions ?? [],
        message_kind: "user",
        system_event: null,
        edited_at: null,
        deleted_at: null,
        reactions: emptyChatReactions(),
        my_reactions: [],
        // Never read for a "mine" bubble (only !mine branches touch
        // sender), so leaving it unset costs nothing while "sending…".
        sender: null,
        reply_to: replyTo,
      };
      qc.setQueryData<VentureMessage[]>(key, [...current, optimistic]);
      return { tempId, replyTo };
    },
    onSuccess: (saved, _input, ctx) => {
      qc.setQueryData<VentureMessage[]>(key, (cur) => {
        const list = cur ?? [];
        const withReplyTo = { ...saved, reply_to: ctx?.replyTo ?? null };
        return list.some((m) => m.id === ctx?.tempId)
          ? list.map((m) => (m.id === ctx?.tempId ? withReplyTo : m))
          : [...list, withReplyTo];
      });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (_error, _input, ctx) => {
      qc.setQueryData<VentureMessage[]>(key, (cur) =>
        (cur ?? []).filter((m) => m.id !== ctx?.tempId),
      );
    },
  });
}

/** Patches one message's fields in the Venture's messages cache, returning
 *  its pre-patch fields so a caller can undo just this one patch later.
 *
 *  Deliberately does NOT snapshot/restore the whole array the way this used
 *  to: a full-array rollback on a bulk action (multi-select unsend fires
 *  several of these concurrently) would restore the cache to its pre-batch
 *  state the moment any *one* of them failed, silently undoing every other
 *  message's already-applied - and possibly already server-confirmed -
 *  change in the same batch. Restoring only the single id a call actually
 *  touched makes concurrent calls independent of each other regardless of
 *  timing. Same fix already applied to Tribe chat's unsendMessage
 *  (TribeScreen.tsx) and DM's patchMessageEverywhere (messages-store.ts)
 *  after this exact bug was found there first. */
function patchVentureMessage(
  qc: ReturnType<typeof useQueryClient>,
  ventureId: string,
  id: string,
  patch: Partial<VentureMessage>,
): VentureMessage | undefined {
  const key = MESSAGES_KEY(ventureId);
  let previous: VentureMessage | undefined;
  qc.setQueryData<VentureMessage[]>(key, (cur) =>
    cur?.map((m) => {
      if (m.id !== id) return m;
      previous ??= m;
      return { ...m, ...patch };
    }),
  );
  return previous;
}

export function useEditVentureMessage(ventureId: string) {
  const fn = useServerFn(editVentureMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; content: string }) => fn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: MESSAGES_KEY(ventureId) });
      const previous = patchVentureMessage(qc, ventureId, input.id, {
        content: input.content,
        edited_at: new Date().toISOString(),
      });
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) patchVentureMessage(qc, ventureId, input.id, context.previous);
    },
    onSuccess: (saved) => {
      patchVentureMessage(qc, ventureId, saved.id, saved);
    },
  });
}

export function useUnsendVentureMessage(ventureId: string) {
  const fn = useServerFn(unsendVentureMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: MESSAGES_KEY(ventureId) });
      const previous = patchVentureMessage(qc, ventureId, id, {
        content: null,
        attachment_url: null,
        attachment_type: null,
        deleted_at: new Date().toISOString(),
      });
      return { previous, id };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) patchVentureMessage(qc, ventureId, context.id, context.previous);
    },
    onSuccess: (saved) => {
      patchVentureMessage(qc, ventureId, saved.id, saved);
    },
  });
}
