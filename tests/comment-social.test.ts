import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const migration = source("../supabase/migrations/20260830040000_comment_likes_and_reposts.sql");
const functions = source("../src/lib/posts.functions.ts");
const store = source("../src/lib/posts-store.ts");
const comments = source("../src/components/mutuals/CommentsModal.tsx");
const postCard = source("../src/components/mutuals/PostCard.tsx");
const push = source("../src/lib/push-payload.ts");

test("comment likes are unique, RLS-protected, and trigger-counted", () => {
  assert.match(migration, /primary key \(comment_id, user_id\)/);
  assert.match(migration, /alter table public\.comment_likes enable row level security/);
  assert.match(migration, /Users like visible comments as themselves/);
  assert.match(migration, /security definer[\s\S]*sync_comment_likes_count/);
  assert.match(migration, /greatest\(likes_count - 1, 0\)/);
});

test("a comment repost is one normal audience-preserving post per user", () => {
  assert.match(migration, /unique index posts_author_quoted_comment_unique/);
  assert.match(functions, /export const toggleCommentRepost/);
  assert.match(functions, /select\("tribe_id, audience"\)/);
  assert.match(functions, /audience: source\.audience/);
  assert.match(functions, /quoted_comment_id: data\.comment_id/);
  assert.match(functions, /content: ""/);
  assert.match(migration, /validate_comment_repost_insert/);
  assert.match(migration, /new\.audience <> source_audience/);
  assert.match(migration, /A Tribe comment must stay inside its source Tribe/);
  assert.match(migration, /Only a Tribe member can repost this comment/);
  assert.match(migration, /prevent_comment_repost_source_update/);
});

test("comment actions are optimistic, accessible, and expose counts", () => {
  assert.match(store, /export function useToggleCommentLike/);
  assert.match(store, /export function useToggleCommentRepost/);
  assert.match(comments, /aria-label=\{liked \? "Unlike comment" : "Like comment"\}/);
  assert.match(comments, /aria-label="Repost options"/);
  assert.match(comments, /aria-pressed=\{liked\}/);
  assert.match(comments, /min-h-11/);
  assert.match(comments, /c\.likes_count > 0/);
  assert.match(comments, /c\.reposts_count > 0/);
  assert.match(comments, /timeAgoLabel\(c\.created_at\)/);
  assert.match(comments, /before:bottom-5 before:left-0 before:top-1/);
});

test("comment repost opens the same safe-area bottom-sheet pattern as post repost", () => {
  assert.match(comments, /title="Repost options"/);
  assert.match(comments, /zIndex=\{60\}/);
  assert.match(comments, /pb-\[max\(1\.25rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(comments, /repostTargetActive \? "Undo repost" : "Repost only"/);
  assert.match(comments, /aria-label="Close repost options"/);
  assert.doesNotMatch(comments, /onClick=\{\(\) => onRepost\(c\.id\)\}/);
});

test("comment reposts render their source and notify both web and push surfaces", () => {
  assert.match(postCard, /QuotedCommentPreview comment=\{post\.quoted_comment\}/);
  assert.match(migration, /'comment_like','comment_repost'/);
  assert.match(push, /comment_like: "liked your comment"/);
  assert.match(push, /comment_repost: "reposted your comment"/);
});
