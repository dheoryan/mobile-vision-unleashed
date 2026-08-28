import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260828010000_scope_new_post_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Tribe-only new-post notifications require recipient membership", () => {
  assert.match(migration, /new\.audience = 'tribe'/);
  assert.match(migration, /recipient_profile\.tribe_ids\s*@>\s*array\[new\.tribe_id\]::text\[\]/);
});

test("public new-post notifications keep the reciprocal follow audience", () => {
  assert.match(migration, /new\.audience = 'all'/);
  assert.match(migration, /follower_id as user_id[\s\S]*followee_id = new\.author_id/);
  assert.match(migration, /followee_id as user_id[\s\S]*follower_id = new\.author_id/);
});
