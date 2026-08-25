import assert from "node:assert/strict";
import test from "node:test";
import {
  dailyPulse,
  emptyTribeRoomReactions,
  roomMetadataNumber,
  roomMetadataString,
} from "../src/lib/tribe-room.ts";

test("Daily Pulse is stable for one Tribe and local date", () => {
  const morning = dailyPulse("cat", new Date(2026, 7, 25, 8, 0));
  const evening = dailyPulse("cat", new Date(2026, 7, 25, 22, 0));

  assert.deepEqual(evening, morning);
  assert.match(morning.id, /^2026-8-25:cat:/);
  assert.ok(morning.question.length > 20);
});

test("Daily Pulse rotates without becoming random per render", () => {
  const prompts = new Set(
    Array.from({ length: 10 }, (_, day) => dailyPulse("cat", new Date(2026, 7, 20 + day)).key),
  );

  assert.ok(prompts.size > 1);
});

test("Room metadata readers reject unexpected values", () => {
  const metadata = { area: "Kemang", max_slots: 6, unsafe: ["wrong shape"] };

  assert.equal(roomMetadataString(metadata, "area"), "Kemang");
  assert.equal(roomMetadataString(metadata, "unsafe", "fallback"), "fallback");
  assert.equal(roomMetadataNumber(metadata, "max_slots", 4), 6);
  assert.equal(roomMetadataNumber(metadata, "area", 4), 4);
});

test("Structured and chat reaction counters share a complete zero state", () => {
  assert.deepEqual(emptyTribeRoomReactions(), {
    spark: 0,
    interested: 0,
    heart: 0,
    laugh: 0,
    support: 0,
  });
});
