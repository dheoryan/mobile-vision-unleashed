import assert from "node:assert/strict";
import test from "node:test";
import { buildPushCopy } from "../src/lib/push-payload.ts";
import { evaluatePushAvailability } from "../src/lib/push-subscribe.ts";

test("Apple mobile browser tabs explain installation before generic feature detection", () => {
  assert.equal(
    evaluatePushAvailability({
      appleMobile: true,
      standalone: false,
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
      hasServiceWorker: false,
      hasPushManager: false,
      hasNotifications: false,
      permission: null,
    }),
    "unsupported",
  );
});

test("private conversations and meetup details never appear in push previews", () => {
  for (const kind of ["message", "hello", "venture_apply", "venture_message"] as const) {
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
