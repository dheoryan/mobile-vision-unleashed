import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_REACTIONS, emptyChatReactions } from "../src/lib/chat.ts";

test("shared chat surfaces expose one stable reaction vocabulary", () => {
  assert.deepEqual(CHAT_REACTIONS, ["heart", "laugh", "support"]);
  assert.deepEqual(emptyChatReactions(), {
    heart: 0,
    laugh: 0,
    support: 0,
  });
});
