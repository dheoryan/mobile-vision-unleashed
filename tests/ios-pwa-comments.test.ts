import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const commentsModalSource = readFileSync(
  new URL("../src/components/mutuals/CommentsModal.tsx", import.meta.url),
  "utf8",
);
const animatedModalSource = readFileSync(
  new URL("../src/components/ui/animated-modal.tsx", import.meta.url),
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

test("comments sheet follows the iOS visual viewport and protects its composer", () => {
  assert.match(commentsModalSource, /useVisualViewport\(open && !!postId\)/);
  assert.match(commentsModalSource, /viewportStyle=\{visualViewportStyle\(visualViewport\)\}/);
  assert.match(commentsModalSource, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(animatedModalSource, /viewportStyle\?: CSSProperties/);
  assert.match(animatedModalSource, /bottom: "auto"/);
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
