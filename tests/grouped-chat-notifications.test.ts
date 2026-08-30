import assert from "node:assert/strict";
import test from "node:test";
import type { NotificationRow } from "../src/lib/notifications.functions.ts";
import { groupChatNotifications, notificationSections } from "../src/lib/notification-presenter.ts";
import { pushNotificationTag } from "../src/lib/push-payload.ts";

const VENTURE_ID = "00000000-0000-4000-8000-000000000002";

function notification(overrides: Partial<NotificationRow>): NotificationRow {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    actor_id: "00000000-0000-4000-8000-000000000001",
    kind: "venture_message",
    post_id: null,
    comment_id: null,
    message_id: null,
    venture_id: VENTURE_ID,
    tribe_id: null,
    preview: "Latest message",
    read_at: null,
    created_at: "2026-08-30T10:00:00.000Z",
    actor: null,
    conversation_name: "Regroup",
    post_image_url: null,
    ...overrides,
  };
}

test("Venture chat traffic becomes one latest-message card per room", () => {
  const latest = notification({ id: "latest" });
  const earlier = notification({
    id: "earlier",
    actor_id: "00000000-0000-4000-8000-000000000003",
    preview: "Earlier message",
    created_at: "2026-08-30T09:00:00.000Z",
  });

  const grouped = groupChatNotifications([latest, earlier]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.id, "latest");
  assert.equal(grouped[0]?.preview, "Latest message");
  assert.equal(grouped[0]?.message_count, 2);
  assert.equal(grouped[0]?.actor_count, 2);
  assert.deepEqual(grouped[0]?.notification_ids, ["latest", "earlier"]);
});

test("mentions stay individual and any unread message keeps the room in New", () => {
  const latestRead = notification({ id: "read", read_at: "2026-08-30T10:01:00.000Z" });
  const earlierUnread = notification({ id: "unread", created_at: "2026-08-30T09:00:00.000Z" });
  const mention = notification({ id: "mention", kind: "mention", tribe_id: VENTURE_ID });

  const grouped = groupChatNotifications([latestRead, earlierUnread, mention]);
  const sections = notificationSections(grouped, new Date("2026-08-30T12:00:00.000Z"));

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0]?.read_at, null);
  assert.equal(grouped[1]?.kind, "mention");
  assert.deepEqual(
    sections.map((section) => section.key),
    ["new"],
  );
});

test("device push replaces the previous alert from the same Venture room", () => {
  const first = pushNotificationTag("venture_message", {
    notificationId: "00000000-0000-4000-8000-000000000010",
    postId: null,
    actorId: "00000000-0000-4000-8000-000000000001",
    ventureId: VENTURE_ID,
  });
  const second = pushNotificationTag("venture_message", {
    notificationId: "00000000-0000-4000-8000-000000000011",
    postId: null,
    actorId: "00000000-0000-4000-8000-000000000003",
    ventureId: VENTURE_ID,
  });

  assert.equal(first, `venture_message-${VENTURE_ID}`);
  assert.equal(second, first);
});
