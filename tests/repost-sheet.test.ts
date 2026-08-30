import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postCardSource = readFileSync(
  new URL("../src/components/mutuals/PostCard.tsx", import.meta.url),
  "utf8",
);

test("repost action opens an accessible bottom sheet", () => {
  assert.match(postCardSource, /title="Repost options"/);
  assert.match(postCardSource, /onOpenChange=\{setRepostMenuOpen\}/);
  assert.match(postCardSource, /pb-\[max\(1\.25rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(postCardSource, /aria-label="Close repost options"/);
  assert.doesNotMatch(postCardSource, /absolute left-0 top-9 z-40 w-44/);
});

test("repost sheet exposes the supported quote and repost paths", () => {
  assert.match(postCardSource, />Quote signal</);
  assert.match(postCardSource, />Repost signal</);
  assert.match(postCardSource, /reposted \? "Undo repost" : "Repost only"/);
  assert.match(postCardSource, /setQuoteOpen\(true\)/);
  assert.match(postCardSource, /toggleRepost\.mutate\(post\.id/);
});
