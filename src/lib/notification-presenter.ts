import type { NotificationKind, NotificationRow } from "@/lib/notifications.functions";

export type NotificationCategory = "social" | "conversation" | "venture" | "tribe";

export interface NotificationSection {
  key: "new" | "today" | "week" | "earlier";
  label: string;
  items: NotificationRow[];
}

export type NotificationDestination =
  | { kind: "post"; postId: string; commentId?: string; scrollOnly: boolean }
  | { kind: "profile"; actorId: string }
  | { kind: "dm"; actorId: string }
  | { kind: "venture"; ventureId: string; mode: "host" | "yours" }
  | { kind: "ventureChat"; ventureId: string }
  | { kind: "tribe"; tribeId: string }
  | { kind: "tab"; tab: "feed" | "discover" | "ventures" | "chats" }
  /** A Hello you haven't answered yet has no DM thread to open ("dm" would
   *  render Thread against someone can_direct_message still says no to) -
   *  this opens MessagesPanel's list view instead, where IncomingHellos
   *  actually lives. */
  | { kind: "chatsInbox" };

const CONVERSATION_KINDS = new Set<NotificationKind>(["message", "hello", "hello_accepted"]);
const VENTURE_KINDS = new Set<NotificationKind>([
  "venture_apply",
  "venture_invite",
  "venture_accept",
  "venture_message",
]);

export function notificationCategory(kind: NotificationKind): NotificationCategory {
  if (CONVERSATION_KINDS.has(kind)) return "conversation";
  if (VENTURE_KINDS.has(kind)) return "venture";
  if (kind === "tribe_join") return "tribe";
  return "social";
}

export function notificationActionLabel(kind: NotificationKind): string {
  switch (kind) {
    case "follow":
      return "View profile";
    case "message":
      return "Reply";
    case "hello":
      return "Review";
    case "hello_accepted":
      return "Message";
    case "venture_apply":
      return "Review request";
    case "venture_invite":
      return "View invite";
    case "venture_accept":
      return "View ticket";
    case "venture_message":
      return "Open chat";
    case "tribe_join":
      return "Open room";
    default:
      return "View";
  }
}

export function notificationDestination(item: NotificationRow): NotificationDestination {
  if (item.kind === "new_post" && item.post_id) {
    return { kind: "post", postId: item.post_id, scrollOnly: true };
  }
  if (
    (item.kind === "like" ||
      item.kind === "comment" ||
      item.kind === "reply" ||
      item.kind === "mention") &&
    item.post_id
  ) {
    return {
      kind: "post",
      postId: item.post_id,
      commentId: item.comment_id ?? undefined,
      scrollOnly: false,
    };
  }
  if (item.kind === "mention" && item.venture_id) {
    return { kind: "ventureChat", ventureId: item.venture_id };
  }
  if (item.kind === "mention" && item.tribe_id) {
    return { kind: "tribe", tribeId: item.tribe_id };
  }
  if (item.kind === "follow") {
    return item.actor_id
      ? { kind: "profile", actorId: item.actor_id }
      : { kind: "tab", tab: "discover" };
  }
  if (item.kind === "hello") return { kind: "chatsInbox" };
  if (item.kind === "hello_accepted" || item.kind === "message") {
    return item.actor_id ? { kind: "dm", actorId: item.actor_id } : { kind: "tab", tab: "chats" };
  }
  if (item.kind === "venture_message") {
    return item.venture_id
      ? { kind: "ventureChat", ventureId: item.venture_id }
      : { kind: "tab", tab: "chats" };
  }
  if (
    item.kind === "venture_apply" ||
    item.kind === "venture_invite" ||
    item.kind === "venture_accept"
  ) {
    const mode = item.kind === "venture_apply" ? "host" : "yours";
    return item.venture_id
      ? { kind: "venture", ventureId: item.venture_id, mode }
      : { kind: "tab", tab: "ventures" };
  }
  if (item.kind === "tribe_join" && item.tribe_id) {
    return { kind: "tribe", tribeId: item.tribe_id };
  }
  return { kind: "tab", tab: "feed" };
}

function startOfLocalDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/**
 * Unread activity stays together regardless of age. Read items then fall into
 * calendar-based groups, so "Today" means the user's local day rather than a
 * rolling 24-hour window.
 */
export function notificationSections(
  items: NotificationRow[],
  now = new Date(),
): NotificationSection[] {
  const today = startOfLocalDay(now);
  const week = today - 6 * 24 * 60 * 60 * 1000;
  const unread: NotificationRow[] = [];
  const todayItems: NotificationRow[] = [];
  const weekItems: NotificationRow[] = [];
  const earlier: NotificationRow[] = [];

  for (const item of items) {
    if (!item.read_at) {
      unread.push(item);
      continue;
    }
    const created = new Date(item.created_at).getTime();
    if (created >= today) todayItems.push(item);
    else if (created >= week) weekItems.push(item);
    else earlier.push(item);
  }

  return [
    { key: "new" as const, label: "New", items: unread },
    { key: "today" as const, label: "Today", items: todayItems },
    { key: "week" as const, label: "This week", items: weekItems },
    { key: "earlier" as const, label: "Earlier", items: earlier },
  ].filter((section) => section.items.length > 0);
}
