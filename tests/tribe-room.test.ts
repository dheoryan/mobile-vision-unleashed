import assert from "node:assert/strict";
import test from "node:test";
import {
  dailyPulse,
  emptyTribeRoomReactions,
  interestedInviteIds,
  roomMetadataNumber,
  roomMetadataString,
  roomMetadataTimeOptions,
} from "../src/lib/tribe-room.ts";

test("Daily Pulse is stable for one Tribe and local date", () => {
  const morning = dailyPulse("cat", new Date(2026, 7, 25, 8, 0));
  const evening = dailyPulse("cat", new Date(2026, 7, 25, 22, 0));

  assert.deepEqual(evening, morning);
  assert.match(morning.id, /^2026-8-25:cat:/);
  assert.ok(morning.question.length > 20);
});

test("proposal conversion invites each interested member once without overwriting applicants", () => {
  assert.deepEqual(
    interestedInviteIds(["host", "a", "b", "a", "c"], ["b", "c"], "host"),
    ["a"],
  );
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
    wow: 0,
    sad: 0,
    like: 0,
    support: 0,
    time_1: 0,
    time_2: 0,
    time_3: 0,
  });
});

test("Tribe plan time options are bounded, labelled, and carry vote counts", () => {
  const reactions = emptyTribeRoomReactions();
  reactions.time_1 = 3;
  reactions.time_2 = 1;
  const options = roomMetadataTimeOptions(
    {
      time_options: [
        { key: "time_1", day: "2026-08-29", period: "afternoon" },
        { key: "time_2", day: "2026-08-30", period: "evening" },
        { key: "time_4", day: "2026-09-01", period: "morning" },
      ],
    },
    reactions,
  );

  assert.equal(options.length, 2);
  assert.deepEqual(
    options.map(({ key, votes }) => ({ key, votes })),
    [
      { key: "time_1", votes: 3 },
      { key: "time_2", votes: 1 },
    ],
  );
  assert.match(options[0].label, /Afternoon$/);
});
