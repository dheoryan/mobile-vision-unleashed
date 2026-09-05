import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import {
  announceTribeVenture,
  answerDailyPulse,
  createTribePlan,
  getTribePulseStreak,
  listTribeRoom,
  markTribeRoomRead,
  notifyTribePulse,
  sharePostToTribe,
  shareTribePlanToChat,
  toggleTribeRoomReaction,
} from "@/lib/tribe-room.functions";
import type { TribePlanTimeOption, TribeRoomItem, TribeRoomReaction } from "@/lib/tribe-room";

const roomKey = (tribeKey: string) => ["tribe-room", tribeKey] as const;

export function useTribeRoom(tribeKey: string, enabled = true) {
  const fn = useServerFn(listTribeRoom);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...roomKey(tribeKey), user?.id ?? null],
    queryFn: () => fn({ data: { tribe_key: tribeKey } }),
    enabled: enabled && !!user && !!tribeKey,
    staleTime: 10_000,
  });
}

export function useTribePulseStreak(tribeKey: string, enabled = true) {
  const fn = useServerFn(getTribePulseStreak);
  return useQuery({
    queryKey: ["tribe-pulse-streak", tribeKey],
    queryFn: () => fn({ data: { tribe_key: tribeKey } }),
    enabled: enabled && !!tribeKey,
    staleTime: 60_000,
  });
}

export function useAnswerDailyPulse(tribeKey: string) {
  const fn = useServerFn(answerDailyPulse);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { prompt_id: string; prompt: string; content: string }) =>
      fn({ data: { tribe_key: tribeKey, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKey(tribeKey) }),
  });
}

export function useCreateTribePlan(tribeKey: string) {
  const fn = useServerFn(createTribePlan);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      note: string;
      timing_mode: "single" | "poll";
      time_options: TribePlanTimeOption[];
      area: string;
      max_slots: number;
    }) => fn({ data: { tribe_key: tribeKey, ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: roomKey(tribeKey) }),
  });
}

/** Not scoped to one Tribe at construction time like the other hooks here -
 *  the share picker calls this once and passes tribe_key per tap, since it
 *  lists every Tribe the sharer has joined, not just the one they're
 *  currently viewing. No chat cache to patch: TribeScreen keeps its own
 *  messages in local state fed by a realtime subscription (see
 *  TribeScreen.tsx), the same path a plain message send already takes -
 *  the one cache this does invalidate is the shared post's own
 *  shares_count, since sharePostToTribe records a `shares` row too. */
export function useSharePostToTribe() {
  const fn = useServerFn(sharePostToTribe);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tribe_key: string; post_id: string; caption?: string | null }) =>
      fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      // See useSharePostToDM's identical note (messages-store.ts): without
      // this, useMyShares' cache never learns the post is now shared, so a
      // follow-up tap on the Share button reads it as unshared and
      // un-shares what was just shared in-app.
      qc.invalidateQueries({ queryKey: ["social", "shares"] });
    },
  });
}

export function useToggleTribeRoomReaction(tribeKey: string) {
  const fn = useServerFn(toggleTribeRoomReaction);
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryPrefix = roomKey(tribeKey);
  return useMutation({
    mutationFn: (input: { message_id: string; reaction: TribeRoomReaction }) => fn({ data: input }),
    onMutate: async ({ message_id, reaction }) => {
      await qc.cancelQueries({ queryKey: queryPrefix });
      const snapshots = qc.getQueriesData<{
        tribe_id: string;
        items: TribeRoomItem[];
        last_read_at: string | null;
      }>({ queryKey: queryPrefix });
      for (const [key, value] of snapshots) {
        if (!value) continue;
        qc.setQueryData(key, {
          ...value,
          items: value.items.map((item) => {
            if (item.id !== message_id) return item;
            const active = item.my_reactions.includes(reaction);
            return {
              ...item,
              my_reactions: active
                ? item.my_reactions.filter((value) => value !== reaction)
                : [...item.my_reactions, reaction],
              reactions: {
                ...item.reactions,
                [reaction]: Math.max(0, item.reactions[reaction] + (active ? -1 : 1)),
              },
            };
          }),
        });
      }
      return { snapshots };
    },
    onError: (_error, _input, context) => {
      for (const [key, value] of context?.snapshots ?? []) qc.setQueryData(key, value);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryPrefix }),
    meta: { userId: user?.id },
  });
}

export function useMarkTribeRoomRead(tribeKey: string) {
  const fn = useServerFn(markTribeRoomRead);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fn({ data: { tribe_key: tribeKey } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chats", "tribe-summary"] }),
  });
}

export function useNotifyTribePulse() {
  const fn = useServerFn(notifyTribePulse);
  return useMutation({
    mutationFn: (input: { tribe_key: string; prompt_id: string; preview: string }) =>
      fn({ data: input }),
  });
}

export function useShareTribePlanToChat() {
  const fn = useServerFn(shareTribePlanToChat);
  return useMutation({
    mutationFn: (input: { tribe_key: string; message_id: string; preview: string }) =>
      fn({ data: input }),
  });
}

export function useAnnounceTribeVenture() {
  const fn = useServerFn(announceTribeVenture);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tribe_key: string; source_message_id: string; venture_id: string }) =>
      fn({ data: input }),
    onSuccess: (_data, input) => qc.invalidateQueries({ queryKey: roomKey(input.tribe_key) }),
  });
}
