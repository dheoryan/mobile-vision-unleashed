import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import {
  applyToVenture,
  closeHostedVenture,
  updateHostedVenture,
  createHostedVenture,
  decideVentureApplication,
  listMyHostedVentures,
  listMyJoinedVentures,
  listOpenVentures,
  listVentureMessages,
  sendVentureMessage,
  type VentureApplication,
  type VentureParty,
  type VentureScope,
  type VentureMessage,
} from "@/lib/ventures.functions";

export type {
  VentureApplication,
  VentureParty,
  VentureScope,
  VentureMessage,
  VentureProfileLite,
} from "@/lib/ventures.functions";

const VENTURES_KEY = ["ventures"] as const;
const OPEN_KEY = ["ventures", "open"] as const;
const HOSTED_KEY = ["ventures", "hosted"] as const;
const JOINED_KEY = ["ventures", "joined"] as const;
const MESSAGES_KEY = (ventureId: string) => ["ventures", "messages", ventureId] as const;

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
      time_window: string;
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
      note?: string;
      max_slots?: number;
      image_url?: string | null;
    }) => fn({ data: input }),
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
  });
}

export function useSendVentureMessage(ventureId: string) {
  const fn = useServerFn(sendVentureMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => fn({ data: { venture_id: ventureId, content } }),
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
