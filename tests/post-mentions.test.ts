import assert from "node:assert/strict";
import test from "node:test";
import { splitPostMentions } from "../src/lib/post-mentions.ts";

test("post mentions preserve surrounding copy and expose profile handles", () => {
  assert.deepEqual(splitPostMentions("Hello @pear_fect and @brrrain.damage!"), [
    { text: "Hello ", handle: null },
    { text: "@pear_fect", handle: "pear_fect" },
    { text: " and ", handle: null },
    { text: "@brrrain.damage", handle: "brrrain.damage" },
    { text: "!", handle: null },
  ]);
});

test("email addresses do not become profile mentions", () => {
  assert.deepEqual(splitPostMentions("Email me at hello@example.com"), [
    { text: "Email me at hello@example.com", handle: null },
  ]);
});
