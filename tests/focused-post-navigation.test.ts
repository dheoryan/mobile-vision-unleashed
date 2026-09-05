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
const sharedPostCardSource = readFileSync(
  new URL("../src/components/mutuals/SharedPostCard.tsx", import.meta.url),
  "utf8",
);

test("notification post links preserve their source for deterministic back navigation", () => {
  assert.match(notificationsSource, /from: "notifications"/);
  assert.match(notificationsSource, /comment: destination\.commentId/);
  assert.match(focusedPostSource, /search\.from === "feed" \|\| search\.from === "notifications"/);
  assert.match(focusedPostSource, /comment: typeof search\.comment === "string"/);
  assert.match(focusedPostSource, /from === "notifications" \? "\/notifications" : "\/"/);
  // "feed" and "chat" both mean a real prior screen is already sitting in
  // history - only "notifications" and a bare shared link (from
  // undefined) fall through to the synthetic-parent-entry path.
  assert.match(
    focusedPostSource,
    /\(from === "feed" \|\| from === "chat"\) && window\.history\.length > 1/,
  );
});

test("a post shared into chat identifies itself as chat, not a bare deep link", () => {
  // SharedPostCard.tsx is the one caller that used to navigate to
  // /p/$postId with no `from` at all, which made the post page treat a
  // real in-app tap (from a DM or Tribe chat, with real history behind it)
  // as an untrusted deep link and inject an extra Home entry - tapping
  // back from a shared post landed on Home instead of the chat thread.
  assert.match(sharedPostCardSource, /from: "chat"/);
  assert.match(focusedPostSource, /from\?: "feed" \| "notifications" \| "chat"/);
});

test("focused posts use the app secondary-header back control", () => {
  assert.match(focusedPostSource, /grid-cols-\[3rem_1fr_3rem\]/);
  assert.match(focusedPostSource, /aria-label=\{from === "notifications"/);
  assert.match(focusedPostSource, /className="flex h-11 w-11/);
  assert.match(focusedPostSource, /<CaretLeftIcon className="h-5 w-5"/);
  assert.doesNotMatch(focusedPostSource, /<ArrowLeft[^>]*\/> Back/);
});

test("focused posts name the page as a MEUTUALS signal thread", () => {
  assert.match(focusedPostSource, />Signal Thread<\/h1>/);
  assert.doesNotMatch(focusedPostSource, />Conversation<\/h1>/);
});
