import assert from "node:assert/strict";
import test from "node:test";
import { buildPushCopy } from "../src/lib/push-payload.ts";
import { evaluatePushAvailability, withPushTimeout } from "../src/lib/push-subscribe.ts";

test("Apple mobile browser tabs explain installation before generic feature detection", () => {
  assert.equal(
    evaluatePushAvailability({
      appleMobile: true,
      standalone: false,
      secureContext: true,
      hasServiceWorker: true,
      hasPushManager: false,
      hasNotifications: false,
      permission: null,
    }),
    "needs-install",
  );
});

test("installed apps distinguish blocked permission from unsupported APIs", () => {
  assert.equal(
    evaluatePushAvailability({
      appleMobile: true,
      standalone: true,
      secureContext: true,
      hasServiceWorker: true,
      hasPushManager: true,
      hasNotifications: true,
      permission: "denied",
    }),
    "blocked",
  );
  assert.equal(
    evaluatePushAvailability({
      appleMobile: false,
      standalone: false,
      secureContext: true,
      hasServiceWorker: false,
      hasPushManager: false,
      hasNotifications: false,
      permission: null,
    }),
    "unsupported",
  );
});

test("insecure origins get an actionable state before API detection", () => {
  assert.equal(
    evaluatePushAvailability({
      appleMobile: false,
      standalone: false,
      secureContext: false,
      hasServiceWorker: false,
      hasPushManager: false,
      hasNotifications: false,
      permission: null,
    }),
    "insecure",
  );
});

test("push operations reject instead of leaving the UI loading forever", async () => {
  await assert.rejects(
    withPushTimeout(new Promise<never>(() => undefined), 5, "Push timed out"),
    /Push timed out/,
  );
});

test("private conversations and meetup details never appear in push previews", () => {
  for (const kind of ["message", "mention", "hello", "venture_apply", "venture_message"] as const) {
    const copy = buildPushCopy("Pear", kind, "Meet me at 19:00 behind the station");
    assert.equal(copy.body, "Open MEUTUALS to view it.");
    assert.equal(copy.body.includes("station"), false);
  }
});

test("public social activity can retain a useful short preview", () => {
  assert.deepEqual(buildPushCopy("Pear", "comment", "Love this idea"), {
    title: "Pear commented on your post",
    body: "Love this idea",
  });
});

test("a new Tribevia notification has no single actor to name", () => {
  assert.deepEqual(buildPushCopy("Pear", "tribe_pulse", "Iron Wolf: Sunrise run this week?"), {
    title: "New Tribevia",
    body: "Iron Wolf: Sunrise run this week?",
  });
  assert.equal(buildPushCopy("Pear", "tribe_pulse", null).body, "Today's question is up.");
});

test("repost and quote notifications name the actor and keep the preview public", () => {
  assert.deepEqual(buildPushCopy("Pear", "repost", "Original post text"), {
    title: "Pear reposted your post",
    body: "Original post text",
  });
  assert.deepEqual(buildPushCopy("Pear", "quote", "Original post text"), {
    title: "Pear quoted your post",
    body: "Original post text",
  });
});
