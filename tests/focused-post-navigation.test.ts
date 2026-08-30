import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const focusedPostSource = readFileSync(
  new URL("../src/routes/p.$postId.tsx", import.meta.url),
  "utf8",
);
const notificationsSource = readFileSync(
  new URL("../src/routes/notifications.tsx", import.meta.url),
  "utf8",
);

test("notification post links preserve their source for deterministic back navigation", () => {
  assert.match(notificationsSource, /search: \{ from: "notifications" \}/);
  assert.match(focusedPostSource, /search\.from === "notifications"/);
  assert.match(
    focusedPostSource,
    /from === "notifications" \? "\/notifications" : "\/"/,
  );
});

test("focused posts use the app secondary-header back control", () => {
  assert.match(focusedPostSource, /grid-cols-\[3rem_1fr_3rem\]/);
  assert.match(focusedPostSource, /aria-label=\{from === "notifications"/);
  assert.match(focusedPostSource, /className="flex h-11 w-11/);
  assert.match(focusedPostSource, /<ChevronLeft className="h-5 w-5"/);
  assert.doesNotMatch(focusedPostSource, /<ArrowLeft[^>]*\/> Back/);
});
