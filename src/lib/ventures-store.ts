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
  listOpenVentures,
  listVentureMessages,
  sendVentureMessage,
  getVentureCoordination,
  setVentureArrivalStatus,
  updateVentureAnnouncement,
  type VentureApplication,
  type VentureParty,
  type VentureScope,
  type VentureMessage,
  type VentureCoordination,
  type VentureArrivalStatus,
} from "@/lib/ventures.functions";
import type { RichMessageInput } from "@/lib/chat";

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
  return useMutation({
    mutationFn: (input: RichMessageInput) => fn({ data: { venture_id: ventureId, ...input } }),
    onSuccess: (message) => {
      qc.setQueryData<VentureMessage[]>(MESSAGES_KEY(ventureId), (cur) => [
        ...(cur ?? []),
        message,
      ]);
      qc.invalidateQueries({ queryKey: MESSAGES_KEY(ventureId) });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
