import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toggleChatReaction } from "@/lib/chat.functions";
import type {
  ChatChannelKind,
  ChatReaction,
  ChatReactionCounts,
  ChatReactionState,
} from "@/lib/chat";

export function useToggleChatReaction(channelKind: ChatChannelKind) {
  const fn = useServerFn(toggleChatReaction);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { message_id: string; reaction: ChatReaction }) =>
      fn({ data: { channel_kind: channelKind, ...input } }),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: channelKind === "dm" ? ["messages"] : ["ventures", "messages"],
      });
    },
  });
}

interface ReactableMessage extends ChatReactionState {
  id: string;
}

export function useOptimisticChatReactions(channelKind: ChatChannelKind) {
  const mutation = useToggleChatReaction(channelKind);
  const [overrides, setOverrides] = useState<
    Record<string, { state: ChatReactionState; baseline: string }>
  >({});

  const signature = (message: ReactableMessage) =>
    JSON.stringify([message.reactions, message.my_reactions]);

  const stateFor = (message: ReactableMessage): ChatReactionState => {
    const override = overrides[message.id];
    if (override?.baseline === signature(message)) return override.state;
    return {
      reactions: message.reactions,
      my_reactions: message.my_reactions,
    };
  };

  const toggle = async (message: ReactableMessage, reaction: ChatReaction) => {
    const previous = stateFor(message);
    const active = previous.my_reactions.includes(reaction);
    const reactions: ChatReactionCounts = {
      ...previous.reactions,
      [reaction]: Math.max(0, previous.reactions[reaction] + (active ? -1 : 1)),
    };
    const optimistic: ChatReactionState = {
      reactions,
      my_reactions: active
        ? previous.my_reactions.filter((value) => value !== reaction)
        : [...previous.my_reactions, reaction],
    };
    setOverrides((current) => ({
      ...current,
      [message.id]: { state: optimistic, baseline: signature(message) },
    }));
    try {
      await mutation.mutateAsync({ message_id: message.id, reaction });
    } catch (error) {
      setOverrides((current) => {
        const next = { ...current };
        delete next[message.id];
        return next;
      });
      throw error;
    }
  };

  return { stateFor, toggle, isPending: mutation.isPending };
}
