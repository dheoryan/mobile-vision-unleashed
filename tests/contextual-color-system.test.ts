import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const notifications = source("../src/routes/notifications.tsx");
const exploreDeck = source("../src/components/mutuals/ExploreDeck.tsx");
const ventures = source("../src/components/mutuals/VenturesScreen.tsx");
const chats = source("../src/components/mutuals/ChatsScreen.tsx");
const ownProfile = source("../src/components/mutuals/ProfileScreen.tsx");
const publicProfile = source("../src/routes/u.$handle.tsx");

test("global attention and action surfaces use the MEUTUALS gradient with white content", () => {
  assert.match(notifications, /h-1\.5 w-1\.5[^"]*bg-meutuals-gradient/);
  assert.match(ventures, /My Ventures[\s\S]{0,240}bg-meutuals-gradient[^"]*text-white/);
  assert.match(chats, /aria-label="New message"[\s\S]{0,260}bg-meutuals-gradient text-white/);
  assert.match(
    exploreDeck,
    /setHelloFor\(person\)[\s\S]{0,500}bg-meutuals-gradient[^"]*text-white/,
  );
});

test("Discover identity accents follow the displayed member's Tribe", () => {
  assert.match(exploreDeck, /borderColor: tribe\.colorVar/);
  assert.match(exploreDeck, /color: tribe\.colorVar/);
  assert.match(exploreDeck, /color-mix\(in oklab, \$\{tribe\.colorVar\} 20%, transparent\)/);
});

test("Here for pills follow the profile's primary Tribe", () => {
  for (const profile of [ownProfile, publicProfile]) {
    assert.match(profile, /accentColor=\{tribe\.colorVar\}/);
    assert.match(profile, /color-mix\(in oklab, \$\{accentColor\} 18%, transparent\)/);
    assert.match(profile, /color: accentColor/);
  }
});

test("edit-profile choices keep readable foregrounds over Tribe-tinted selected pills", () => {
  assert.match(ownProfile, /accentColor=\{choiceTribe\.colorVar\}/);
  assert.match(ownProfile, /color-mix\(in oklab, \$\{color\} 26%, var\(--card\)\)/);
  assert.match(ownProfile, /active[\s\S]{0,80}\? "text-foreground"/);
  // The active state's color-tinted background/border is itself the
  // selected indicator now - a separate check icon read as redundant once
  // pools grew large enough that every row is either clearly filled in or
  // clearly not.
  assert.doesNotMatch(ownProfile, /CheckIcon/);
  assert.match(ownProfile, /bg-meutuals-gradient py-3\.5 text-sm font-semibold text-white/);
  assert.match(ownProfile, /Save changes/);
});
