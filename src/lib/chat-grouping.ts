export type ChatGroupPosition = "single" | "start" | "middle" | "end";

type GroupableMessage = {
  sender_id: string;
  created_at: string;
};

// Keep short conversational bursts visually together without merging messages
// that merely happen to be adjacent in a quiet room.
const GROUP_WINDOW_MS = 15 * 60 * 1000;

function belongsTogether(a: GroupableMessage | undefined, b: GroupableMessage | undefined) {
  if (!a || !b || a.sender_id !== b.sender_id) return false;
  const gap = Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return Number.isFinite(gap) && gap <= GROUP_WINDOW_MS;
}

export function chatGroupPosition<T extends GroupableMessage>(
  messages: T[],
  index: number,
  isSystem: (message: T) => boolean = () => false,
): ChatGroupPosition {
  const current = messages[index];
  if (!current || isSystem(current)) return "single";

  const previous = messages[index - 1];
  const next = messages[index + 1];
  const withPrevious = previous && !isSystem(previous) && belongsTogether(previous, current);
  const withNext = next && !isSystem(next) && belongsTogether(current, next);

  if (withPrevious && withNext) return "middle";
  if (withPrevious) return "end";
  if (withNext) return "start";
  return "single";
}

export const startsChatGroup = (position: ChatGroupPosition) =>
  position === "single" || position === "start";

export const endsChatGroup = (position: ChatGroupPosition) =>
  position === "single" || position === "end";

export function chatBubbleShape(position: ChatGroupPosition, mine: boolean) {
  if (position === "single") {
    return mine ? "rounded-[14px] rounded-br-[5px]" : "rounded-[14px] rounded-bl-[5px]";
  }
  if (position === "start") {
    return mine ? "rounded-[14px] rounded-br-[3px]" : "rounded-[14px] rounded-bl-[3px]";
  }
  if (position === "middle") {
    return mine ? "rounded-l-[14px] rounded-r-[3px]" : "rounded-l-[3px] rounded-r-[14px]";
  }
  return mine ? "rounded-[14px] rounded-tr-[3px]" : "rounded-[14px] rounded-tl-[3px]";
}

export const chatGroupSpacing = (position: ChatGroupPosition) =>
  startsChatGroup(position) ? "mt-4" : "mt-1";
