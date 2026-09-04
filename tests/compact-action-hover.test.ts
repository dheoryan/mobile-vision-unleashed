import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const comments = source("../src/components/mutuals/CommentsModal.tsx");
const postCard = source("../src/components/mutuals/PostCard.tsx");
const postOwnMenu = source("../src/components/mutuals/PostOwnMenu.tsx");
const safetyMenu = source("../src/components/mutuals/SafetyMenu.tsx");

test("compact comment actions use semantic color hover without gray pills", () => {
  assert.match(comments, /hover:text-primary active:scale-95/);
  assert.match(comments, /hover:text-rose-400/);
  assert.match(comments, /hover:text-emerald-400/);
  assert.doesNotMatch(comments, /hover:bg-secondary\/60/);
  assert.doesNotMatch(comments, /bg-rose-400\/10/);
  assert.doesNotMatch(comments, /bg-emerald-400\/10/);
});

test("ellipsis triggers keep their touch target and hover through color only", () => {
  assert.match(
    safetyMenu,
    /h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary/,
  );
  // Own-post "..." trigger lives in PostOwnMenu now (same sheet pattern as
  // SafetyMenu/CommentOwnMenu), not inline in PostCard's own markup.
  assert.match(
    postOwnMenu,
    /aria-label="Post options"[\s\S]*?h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary/,
  );
  assert.doesNotMatch(
    postCard,
    /h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/,
  );
});

test("post footer actions advertise their meaning with color", () => {
  assert.match(postCard, /hover:text-rose-400/);
  assert.match(postCard, /hover:text-primary/);
  assert.match(postCard, /hover:text-emerald-400/);
  // Save moved out of the footer into the "…" sheet (SafetyMenu's post
  // options for someone else's post, PostOwnMenu for yours) - still amber,
  // just no longer a footer hover affordance since both are full menu rows
  // rather than compact icon buttons.
  assert.match(postOwnMenu, /text-amber-400/);
  assert.match(safetyMenu, /text-amber-400/);
});
