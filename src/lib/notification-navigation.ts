import type { NotificationDestination } from "@/lib/notification-presenter";

export type NotificationHomeTarget =
  | "post"
  | "feed-post"
  | "dm"
  | "venture"
  | "venture-chat"
  | "tribe"
  | "tab";

export type NotificationHomeTab = "feed" | "discover" | "ventures" | "chats";

export interface NotificationHomeSearch {
  notification?: NotificationHomeTarget;
  target?: string;
  comment?: string;
  mode?: "host" | "yours";
  tab?: NotificationHomeTab;
}

const TARGETS = new Set<NotificationHomeTarget>([
  "post",
  "feed-post",
  "dm",
  "venture",
  "venture-chat",
  "tribe",
  "tab",
]);
const TABS = new Set<NotificationHomeTab>(["feed", "discover", "ventures", "chats"]);

function isNotificationTarget(value: string): value is NotificationHomeTarget {
  return TARGETS.has(value as NotificationHomeTarget);
}

function isNotificationTab(value: string): value is NotificationHomeTab {
  return TABS.has(value as NotificationHomeTab);
}

function boundedString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= 128 ? value : undefined;
}

/**
 * Validate notification deep links at the route boundary. A partial or edited
 * URL falls back to the normal home screen instead of opening an ambiguous
 * destination.
 */
export function parseNotificationHomeSearch(
  search: Record<string, unknown>,
): NotificationHomeSearch {
  const notification = boundedString(search.notification);
  if (!notification || !isNotificationTarget(notification)) return {};

  if (notification === "tab") {
    const tab = boundedString(search.tab);
    return tab && isNotificationTab(tab) ? { notification, tab } : {};
  }

  const target = boundedString(search.target);
  if (!target) return {};

  if (notification === "venture") {
    const mode = search.mode === "host" || search.mode === "yours" ? search.mode : undefined;
    return mode ? { notification, target, mode } : {};
  }

  if (notification === "post") {
    return {
      notification,
      target,
      comment: boundedString(search.comment),
    };
  }

  return { notification, target };
}

/** Convert a typed notification destination into a reload-safe home URL. */
export function notificationHomeSearch(
  destination: NotificationDestination,
): NotificationHomeSearch | null {
  switch (destination.kind) {
    case "post":
      return {
        notification: destination.scrollOnly ? "feed-post" : "post",
        target: destination.postId,
        comment: destination.commentId,
      };
    case "dm":
      return { notification: "dm", target: destination.actorId };
    case "venture":
      return {
        notification: "venture",
        target: destination.ventureId,
        mode: destination.mode,
      };
    case "ventureChat":
      return { notification: "venture-chat", target: destination.ventureId };
    case "tribe":
      return { notification: "tribe", target: destination.tribeId };
    case "tab":
      return { notification: "tab", tab: destination.tab };
    case "profile":
      return null;
  }
}
