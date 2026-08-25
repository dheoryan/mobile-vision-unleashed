export const CHAT_REACTIONS = ["heart", "laugh", "support"] as const;

export type ChatReaction = (typeof CHAT_REACTIONS)[number];
export type ChatChannelKind = "dm" | "venture";
export type ChatReactionCounts = Record<ChatReaction, number>;

export interface ChatReactionState {
  reactions: ChatReactionCounts;
  my_reactions: ChatReaction[];
}

export function emptyChatReactions(): ChatReactionCounts {
  return { heart: 0, laugh: 0, support: 0 };
}

export interface RichMessageInput {
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: "image" | null;
  reply_to_id?: string | null;
}
