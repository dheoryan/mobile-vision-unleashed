import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  shouldTriggerSwipeReply,
  swipeReplyOffset,
  SWIPE_REPLY_THRESHOLD,
} from "../src/hooks/use-swipe-reply.ts";

test("swipe-to-reply ignores leftward movement and resists long drags", () => {
  assert.equal(swipeReplyOffset(-30), 0);
  assert.ok(swipeReplyOffset(30) < 30);
  assert.equal(swipeReplyOffset(500), 72);
});

test("reply triggers only after the released bubble crosses the threshold", () => {
  assert.equal(shouldTriggerSwipeReply(SWIPE_REPLY_THRESHOLD - 1), false);
  assert.equal(shouldTriggerSwipeReply(SWIPE_REPLY_THRESHOLD), true);
});

test("chat reaction controls render native emoji instead of outline icons", () => {
  const source = readFileSync(
    new URL("../src/components/mutuals/ChatMessageActions.tsx", import.meta.url),
    "utf8",
  );

  for (const emoji of ["❤️", "😂", "🤝"]) assert.ok(source.includes(emoji));
  for (const icon of ["Heart", "Laugh", "HandHeart"]) assert.equal(source.includes(icon), false);
});
