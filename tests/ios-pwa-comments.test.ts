import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const commentsModalSource = readFileSync(
  new URL("../src/components/mutuals/CommentsModal.tsx", import.meta.url),
  "utf8",
);
const postCardSource = readFileSync(
  new URL("../src/components/mutuals/PostCard.tsx", import.meta.url),
  "utf8",
);
const focusedPostSource = readFileSync(
  new URL("../src/routes/p.$postId.tsx", import.meta.url),
  "utf8",
);
const chatsSource = readFileSync(
  new URL("../src/components/mutuals/ChatsScreen.tsx", import.meta.url),
  "utf8",
);
const postFunctionsSource = readFileSync(
  new URL("../src/lib/posts.functions.ts", import.meta.url),
  "utf8",
);

test("comments use a modal-free page thread with a safe sticky composer", () => {
  assert.match(commentsModalSource, /export function CommentsThread/);
  assert.match(commentsModalSource, /<section id="comments"/);
  assert.match(commentsModalSource, /glass sticky bottom-0 z-10/);
  assert.match(commentsModalSource, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(commentsModalSource, /text-base placeholder:text-muted-foreground/);
  assert.doesNotMatch(commentsModalSource, /title="Comments"/);
  assert.doesNotMatch(postCardSource, /<CommentsModal/);
  assert.match(postCardSource, /to: "\/p\/\$postId"/);
  assert.match(focusedPostSource, /<CommentsThread/);
  assert.match(focusedPostSource, /commentsInline/);
});

test("Chats new-message action clears the Home Screen navigation safe area", () => {
  assert.match(chatsSource, /bottom-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/);
});

test("unhide delegates directly to the RLS-authorized RPC", () => {
  const start = postFunctionsSource.indexOf("export const unhideComment");
  assert.notEqual(start, -1);
  const block = postFunctionsSource.slice(start, start + 1_200);
  assert.match(block, /rpc\("unhide_own_post_comment"/);
  assert.doesNotMatch(block, /from\("comments"\)/);
});
