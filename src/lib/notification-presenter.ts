import type { NotificationKind, NotificationRow } from "@/lib/notifications.functions";

export type NotificationCategory = "social" | "conversation" | "venture" | "tribe";

export interface NotificationSection {
  key: "new" | "today" | "week" | "earlier";
  label: string;
  items: NotificationViewItem[];
}

export interface NotificationViewItem extends NotificationRow {
  /** Every source row represented by this card. */
  notification_ids: string[];
  message_count: number;
  actor_count: number;
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
  if (kind === "tribe_join" || kind === "tribe_pulse") return "tribe";
  return "social";
}

/**
 * A busy group room should occupy one place in the activity inbox, not one
 * card per message. Direct mentions intentionally remain individual because
 * they require the member's attention. Input is newest-first and output keeps
 * that ordering, using the latest message as the card preview.
 */
export function groupChatNotifications(items: NotificationRow[]): NotificationViewItem[] {
  const grouped = new Map<string, { item: NotificationViewItem; actorIds: Set<string> }>();
  const result: NotificationViewItem[] = [];

  for (const notification of items) {
    const groupKey =
      notification.kind === "venture_message" && notification.venture_id
        ? `venture:${notification.venture_id}`
        : null;

    if (!groupKey) {
      result.push({
        ...notification,
        notification_ids: [notification.id],
        message_count: 1,
        actor_count: notification.actor_id ? 1 : 0,
      });
      continue;
    }

    const existing = grouped.get(groupKey);
    if (!existing) {
      const actorIds = new Set<string>();
      if (notification.actor_id) actorIds.add(notification.actor_id);
      const item: NotificationViewItem = {
        ...notification,
        notification_ids: [notification.id],
        message_count: 1,
        actor_count: actorIds.size,
      };
      grouped.set(groupKey, { item, actorIds });
      result.push(item);
      continue;
    }

    existing.item.notification_ids.push(notification.id);
    existing.item.message_count += 1;
    if (notification.actor_id) existing.actorIds.add(notification.actor_id);
    existing.item.actor_count = existing.actorIds.size;
    if (!notification.read_at) existing.item.read_at = null;
  }

  return result;
}

export function notificationDestination(item: NotificationRow): NotificationDestination {
  if (item.kind === "new_post" && item.post_id) {
    return { kind: "post", postId: item.post_id, scrollOnly: true };
  }
  if (
    (item.kind === "like" ||
      item.kind === "comment" ||
      item.kind === "reply" ||
      item.kind === "mention" ||
      item.kind === "repost" ||
      item.kind === "quote" ||
      item.kind === "comment_like" ||
      item.kind === "comment_repost") &&
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
  if ((item.kind === "tribe_join" || item.kind === "tribe_pulse") && item.tribe_id) {
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
  items: NotificationViewItem[],
  now = new Date(),
): NotificationSection[] {
  const today = startOfLocalDay(now);
  const week = today - 6 * 24 * 60 * 60 * 1000;
  const unread: NotificationViewItem[] = [];
  const todayItems: NotificationViewItem[] = [];
  const weekItems: NotificationViewItem[] = [];
  const earlier: NotificationViewItem[] = [];

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
