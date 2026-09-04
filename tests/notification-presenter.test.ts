import assert from "node:assert/strict";
import test from "node:test";
import type { NotificationRow } from "../src/lib/notifications.functions.ts";
import {
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
    conversation_name: null,
    post_image_url: null,
    ...overrides,
  };
}

test("high-intent activity resolves to stable categories", () => {
  assert.equal(notificationCategory("venture_accept"), "venture");
  assert.equal(notificationCategory("message"), "conversation");
  assert.equal(notificationCategory("tribe_pulse"), "tribe");
});

test("a Tribevia notification routes to its Tribe, not the Feed fallback", () => {
  assert.deepEqual(
    notificationDestination(notification({ kind: "tribe_pulse", tribe_id: "wolf" })),
    { kind: "tribe", tribeId: "wolf" },
  );
  // Without a tribe_id (e.g. an older row from before the fan-out function
  // started setting it) there's nothing to route on, so it falls back same
  // as any other under-specified notification rather than throwing.
  assert.deepEqual(notificationDestination(notification({ kind: "tribe_pulse" })), {
    kind: "tab",
    tab: "feed",
  });
});

test("every high-intent kind resolves to its actionable context", () => {
  // A Hello nobody's answered yet has no DM thread to open - "dm" would
  // render an empty Thread whose composer fails on send, since
  // can_direct_message is still false. It needs MessagesPanel's list view,
  // where IncomingHellos actually lives.
  assert.deepEqual(
    notificationDestination(
      notification({ kind: "hello", actor_id: "00000000-0000-4000-8000-000000000001" }),
    ),
    { kind: "chatsInbox" },
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
  assert.deepEqual(notificationHomeSearch({ kind: "chatsInbox" }), { notification: "chats-inbox" });
  assert.deepEqual(parseNotificationHomeSearch({ notification: "chats-inbox" }), {
    notification: "chats-inbox",
  });
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
