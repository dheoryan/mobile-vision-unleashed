import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMention,
  collectMentionIds,
  mentionRangeAtCaret,
} from "../src/lib/mentions.ts";

test("mention picker follows the caret instead of assuming the end of the message", () => {
  assert.deepEqual(mentionRangeAtCaret("Meet @pea tomorrow", 9), {
    query: "pea",
    start: 5,
  });
  assert.equal(mentionRangeAtCaret("email@example.com", 17), null);
});

test("applying a mention preserves text after the caret", () => {
  assert.deepEqual(applyMention("Meet @pea tomorrow", 9, 5, "pear_fect"), {
    text: "Meet @pear_fect tomorrow",
    caret: 16,
  });
});

test("mention ids are deduplicated and only complete handles resolve", () => {
  const registry = new Map([
    ["pear_fect", "00000000-0000-4000-8000-000000000001"],
    ["alharx", "00000000-0000-4000-8000-000000000002"],
  ]);

  assert.deepEqual(
    collectMentionIds("@pear_fect hi @alharx. @pear_fect again", registry),
    [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ],
  );
  assert.deepEqual(collectMentionIds("not@pear_fect and @pear_fect_extra", registry), []);
});
