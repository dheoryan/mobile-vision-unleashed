import assert from "node:assert/strict";
import test from "node:test";
import type { NotificationRow } from "../src/lib/notifications.functions.ts";
import {
  notificationActionLabel,
  notificationCategory,
  notificationDestination,
  notificationSections,
} from "../src/lib/notification-presenter.ts";
import {
  notificationHomeSearch,
  parseNotificationHomeSearch,
} from "../src/lib/notification-navigation.ts";

function notification(overrides: Partial<NotificationRow>): NotificationRow {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    actor_id: null,
    kind: "like",
    post_id: null,
    comment_id: null,
    message_id: null,
    venture_id: null,
    tribe_id: null,
    preview: null,
    read_at: "2026-08-26T09:00:00.000Z",
    created_at: "2026-08-26T09:00:00.000Z",
    actor: null,
    ...overrides,
  };
}

test("high-intent activity gets specific actions and stable categories", () => {
  assert.equal(notificationActionLabel("venture_apply"), "Review request");
  assert.equal(notificationActionLabel("hello"), "Review");
  assert.equal(notificationCategory("venture_accept"), "venture");
  assert.equal(notificationCategory("message"), "conversation");
});

test("every high-intent kind resolves to its actionable context", () => {
  assert.deepEqual(
    notificationDestination(
      notification({ kind: "hello", actor_id: "00000000-0000-4000-8000-000000000001" }),
    ),
    { kind: "tab", tab: "chats" },
  );
  assert.deepEqual(
    notificationDestination(
      notification({
        kind: "hello_accepted",
        actor_id: "00000000-0000-4000-8000-000000000001",
      }),
    ),
    { kind: "dm", actorId: "00000000-0000-4000-8000-000000000001" },
  );
  assert.deepEqual(
    notificationDestination(
      notification({
        kind: "venture_apply",
        venture_id: "00000000-0000-4000-8000-000000000002",
      }),
    ),
    {
      kind: "venture",
      ventureId: "00000000-0000-4000-8000-000000000002",
      mode: "host",
    },
  );
  assert.deepEqual(
    notificationDestination(
      notification({
        kind: "venture_message",
        venture_id: "00000000-0000-4000-8000-000000000002",
      }),
    ),
    { kind: "ventureChat", ventureId: "00000000-0000-4000-8000-000000000002" },
  );
  assert.deepEqual(
    notificationDestination(
      notification({
        kind: "mention",
        venture_id: "00000000-0000-4000-8000-000000000002",
      }),
    ),
    { kind: "ventureChat", ventureId: "00000000-0000-4000-8000-000000000002" },
  );
  assert.deepEqual(
    notificationDestination(
      notification({
        kind: "mention",
        tribe_id: "00000000-0000-4000-8000-000000000005",
      }),
    ),
    { kind: "tribe", tribeId: "00000000-0000-4000-8000-000000000005" },
  );
});

test("home destinations survive a route change and reject incomplete URLs", () => {
  assert.deepEqual(
    notificationHomeSearch({
      kind: "venture",
      ventureId: "00000000-0000-4000-8000-000000000002",
      mode: "host",
    }),
    {
      notification: "venture",
      target: "00000000-0000-4000-8000-000000000002",
      mode: "host",
    },
  );
  assert.deepEqual(
    parseNotificationHomeSearch({
      notification: "post",
      target: "00000000-0000-4000-8000-000000000003",
      comment: "00000000-0000-4000-8000-000000000004",
    }),
    {
      notification: "post",
      target: "00000000-0000-4000-8000-000000000003",
      comment: "00000000-0000-4000-8000-000000000004",
    },
  );
  assert.deepEqual(parseNotificationHomeSearch({ notification: "dm" }), {});
  assert.deepEqual(parseNotificationHomeSearch({ notification: "tab", tab: "profile" }), {});
});

test("unread activity remains in New even when it is old", () => {
  const oldUnread = notification({
    read_at: null,
    created_at: "2026-08-01T09:00:00.000Z",
  });
  const sections = notificationSections([oldUnread], new Date("2026-08-26T15:00:00.000Z"));

  assert.deepEqual(
    sections.map((section) => section.key),
    ["new"],
  );
  assert.equal(sections[0]?.items[0]?.id, oldUnread.id);
});

test("read activity uses local calendar groups instead of rolling 24 hours", () => {
  const sections = notificationSections(
    [
      notification({ id: "today", created_at: "2026-08-26T00:01:00" }),
      notification({ id: "week", created_at: "2026-08-24T23:00:00" }),
      notification({ id: "earlier", created_at: "2026-08-01T09:00:00" }),
    ],
    new Date("2026-08-26T23:30:00"),
  );

  assert.deepEqual(
    sections.map((section) => [section.key, section.items[0]?.id]),
    [
      ["today", "today"],
      ["week", "week"],
      ["earlier", "earlier"],
    ],
  );
});
