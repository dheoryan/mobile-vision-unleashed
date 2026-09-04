import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const bottomNav = source("../src/components/mutuals/BottomNav.tsx");
const notificationBell = source("../src/components/mutuals/NotificationBell.tsx");
const chats = source("../src/components/mutuals/ChatsScreen.tsx");
const postCard = source("../src/components/mutuals/PostCard.tsx");
const postOwnMenu = source("../src/components/mutuals/PostOwnMenu.tsx");
const comments = source("../src/components/mutuals/CommentsModal.tsx");

test("primary navigation uses matched Phosphor outline and filled states", () => {
  assert.match(bottomNav, /@phosphor-icons\/react\/dist\/csr\/Newspaper/);
  assert.match(bottomNav, /weight=\{isActive \? "fill" : "regular"\}/);
  assert.match(bottomNav, /isActive[\s\S]*"font-semibold text-foreground"/);
  assert.doesNotMatch(bottomNav, /bg-primary\/15/);
});

test("stateful social controls use Phosphor fill weights", () => {
  assert.match(postCard, /<HeartIcon[^>]*weight=\{liked \? "fill" : "regular"\}/);
  // Save/unsave lives in PostOwnMenu now (the "..." sheet), not inline in
  // PostCard's own markup - same component Timeline and Profile's post
  // history both render through, so this covers both at once.
  assert.match(postOwnMenu, /<BookmarkSimpleIcon[^>]*weight=\{saved \? "fill" : "regular"\}/);
  assert.match(postCard, /<RepeatIcon[^>]*weight=\{reposted \? "fill" : "regular"\}/);
  assert.match(comments, /<HeartIcon[^>]*weight=\{liked \? "fill" : "regular"\}/);
  assert.match(comments, /<RepeatIcon[^>]*weight=\{reposted \? "fill" : "regular"\}/);
});

test("global unread counts use the MEUTUALS gradient with white numerals", () => {
  for (const value of [bottomNav, notificationBell, chats]) {
    assert.match(value, /bg-meutuals-gradient[^"]*text-white/);
  }
  assert.match(notificationBell, /weight=\{unread > 0 \? "fill" : "regular"\}/);
});
