import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHAT_REACTIONS,
  CHAT_REACTION_META,
  emptyChatReactions,
} from "../src/lib/chat.ts";

test("shared chat surfaces expose one stable reaction vocabulary", () => {
  assert.deepEqual(CHAT_REACTIONS, ["heart", "laugh", "wow", "sad", "like", "support"]);
  assert.deepEqual(emptyChatReactions(), {
    heart: 0,
    laugh: 0,
    wow: 0,
    sad: 0,
    like: 0,
    support: 0,
  });
  assert.deepEqual(
    CHAT_REACTIONS.map((reaction) => CHAT_REACTION_META[reaction].emoji),
    ["❤️", "😂", "😮", "😢", "👍", "🤝"],
  );
});

test("the database migration accepts every shared reaction in both chat stores", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260828010000_expand_chat_reactions.sql",
      import.meta.url,
    ),
    "utf8",
  );

  const tribeConstraintStart = migration.indexOf("alter table public.tribe_room_reactions");
  const chatConstraint = migration.slice(0, tribeConstraintStart);
  const tribeConstraint = migration.slice(tribeConstraintStart);

  assert.ok(tribeConstraintStart > 0);
  for (const reaction of CHAT_REACTIONS) {
    assert.ok(chatConstraint.includes(`'${reaction}'`), `${reaction} is missing from DM/Venture`);
    assert.ok(tribeConstraint.includes(`'${reaction}'`), `${reaction} is missing from Tribe chat`);
  }
});
