export const CHAT_REACTIONS = ["heart", "laugh", "wow", "sad", "like", "support"] as const;

export type ChatReaction = (typeof CHAT_REACTIONS)[number];
export type ChatChannelKind = "dm" | "venture";
export type ChatReactionCounts = Record<ChatReaction, number>;

export const CHAT_REACTION_META: Record<ChatReaction, { label: string; emoji: string }> = {
  heart: { label: "Love", emoji: "❤️" },
  laugh: { label: "Funny", emoji: "😂" },
  wow: { label: "Wow", emoji: "😮" },
  sad: { label: "Sad", emoji: "😢" },
  like: { label: "Like", emoji: "👍" },
  support: { label: "Support", emoji: "🤝" },
};

export function isChatReaction(value: string): value is ChatReaction {
  return (CHAT_REACTIONS as readonly string[]).includes(value);
}

export interface ChatReactionState {
  reactions: ChatReactionCounts;
  my_reactions: ChatReaction[];
}

export function emptyChatReactions(): ChatReactionCounts {
  return { heart: 0, laugh: 0, wow: 0, sad: 0, like: 0, support: 0 };
}

/** Content written for a shared-post message when the sender adds no
 *  caption of their own - every "has content or attachment" constraint on
 *  messages/tribe_messages still requires non-empty content, and this is
 *  the one literal both server functions and both chat screens agree on so
 *  the UI can recognize and hide it (it renders as the preview card
 *  instead), rather than showing a redundant caption line under the card. */
export const SHARED_POST_DEFAULT_CAPTION = "Shared a post";

export interface RichMessageInput {
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: "image" | null;
  reply_to_id?: string | null;
  mentions?: string[];
}
