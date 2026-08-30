import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const safetyMenuSource = readFileSync(
  new URL("../src/components/mutuals/SafetyMenu.tsx", import.meta.url),
  "utf8",
);
const commentsModalSource = readFileSync(
  new URL("../src/components/mutuals/CommentsModal.tsx", import.meta.url),
  "utf8",
);

test("safety options use the shared mobile bottom sheet instead of an anchored popover", () => {
  assert.match(safetyMenuSource, /title=\{`\$\{kindLabel\} options`\}/);
  assert.match(safetyMenuSource, /onOpenChange=\{setOpen\}/);
  assert.match(safetyMenuSource, /zIndex=\{60\}/);
  assert.match(safetyMenuSource, /pb-\[max\(1\.25rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.doesNotMatch(safetyMenuSource, /absolute right-0 top-9 z-40 w-44/);
});

test("comment safety sheet keeps report and block actions available", () => {
  assert.match(safetyMenuSource, />Report \{kind\}</);
  assert.match(safetyMenuSource, />Block \{targetName\}</);
  assert.match(safetyMenuSource, /setReportOpen\(true\)/);
  assert.match(safetyMenuSource, /blockUser\.mutate\(targetUserId/);
  assert.match(safetyMenuSource, /aria-label=\{`Close \$\{kind\} options`\}/);
});

test("post-owner hide action lives inside comment options instead of the comment row", () => {
  assert.match(safetyMenuSource, /onHideComment\?: \(\) => void/);
  assert.match(safetyMenuSource, />Hide comment</);
  assert.match(safetyMenuSource, /onHideComment\(\)/);
  assert.match(commentsModalSource, /onHideComment=\{isPostOwner \? \(\) => onHide\(c\.id\)/);
  assert.doesNotMatch(commentsModalSource, /aria-label="Hide comment from your post"/);
});

test("safety controls meet mobile touch-target and nested-dialog requirements", () => {
  assert.match(safetyMenuSource, /flex h-11 w-11 items-center/);
  assert.match(safetyMenuSource, /title=\{`Report \$\{kind\}`\}/);
  assert.match(safetyMenuSource, /zIndex=\{70\}/);
});
