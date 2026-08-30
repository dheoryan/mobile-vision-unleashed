import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postCardSource = readFileSync(
  new URL("../src/components/mutuals/PostCard.tsx", import.meta.url),
  "utf8",
);
const choicesSource = readFileSync(
  new URL("../src/components/mutuals/RepostAudienceChoices.tsx", import.meta.url),
  "utf8",
);
const socialFunctionsSource = readFileSync(
  new URL("../src/lib/social.functions.ts", import.meta.url),
  "utf8",
);
const postsFunctionsSource = readFileSync(
  new URL("../src/lib/posts.functions.ts", import.meta.url),
  "utf8",
);
const audienceMigration = readFileSync(
  new URL("../supabase/migrations/20260830100000_repost_audience.sql", import.meta.url),
  "utf8",
);

test("repost action opens an accessible bottom sheet", () => {
  assert.match(postCardSource, /title="Repost options"/);
  assert.match(postCardSource, /onOpenChange=\{setRepostMenuOpen\}/);
  assert.match(postCardSource, /pb-\[max\(1\.25rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(postCardSource, /aria-label="Close repost options"/);
  assert.doesNotMatch(postCardSource, /absolute left-0 top-9 z-40 w-44/);
});

test("repost sheet exposes quote plus Tribe and Wild repost destinations", () => {
  assert.match(postCardSource, />Quote signal</);
  assert.match(postCardSource, />Repost signal</);
  assert.match(postCardSource, /<RepostAudienceChoices/);
  assert.match(postCardSource, /allowWild=\{post\.audience === "all"\}/);
  assert.match(postCardSource, /onSelect=\{changeRepost\}/);
  assert.match(choicesSource, />My Tribe</);
  assert.match(choicesSource, />The Wild</);
  assert.match(choicesSource, /The original is Tribe-only/);
  assert.match(postCardSource, /setQuoteOpen\(true\)/);
  assert.match(postCardSource, /\{ postId: post\.id, audience \}/);
});

test("server and database prevent a repost from widening its source audience", () => {
  assert.match(socialFunctionsSource, /z\.enum\(\["tribe", "all"\]\)/);
  assert.match(socialFunctionsSource, /source\.audience === "tribe" && data\.audience !== "tribe"/);
  assert.match(socialFunctionsSource, /tribe_id: data\.audience === "tribe" \? viewerTribe : null/);
  assert.match(postsFunctionsSource, /r\.audience === "tribe" && r\.tribe_id === data\.tribe_id/);
  assert.match(postsFunctionsSource, /r\.audience === "all"/);
  assert.match(audienceMigration, /add column audience text/);
  assert.match(audienceMigration, /validate_repost_audience_insert/);
  assert.match(audienceMigration, /A Tribe-only signal cannot be reposted to The Wild/);
  assert.match(audienceMigration, /public\.is_tribe_member\(tribe_id, auth\.uid\(\)\)/);
});
