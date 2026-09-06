import assert from "node:assert/strict";
import test from "node:test";
import {
  curateForMood,
  curateUnseenForMood,
  moodAffinity,
  type MoodCandidate,
} from "../src/lib/explore-moods.ts";

const candidate = (id: string, overrides: Partial<MoodCandidate> = {}): MoodCandidate => ({
  id,
  interests: [],
  socialIntents: [],
  availability: [],
  matchScore: 50,
  ...overrides,
});

test("mood lenses promote relevant stated signals", () => {
  assert.ok(
    moodAffinity(candidate("coffee", { interests: ["coffee"] }), "coffee") >
      moodAffinity(candidate("books", { interests: ["books"] }), "coffee"),
  );
  assert.ok(
    moodAffinity(candidate("creative", { socialIntents: ["creative_collab"] }), "create") >
      moodAffinity(candidate("network", { socialIntents: ["networking"] }), "create"),
  );
});

test("surprise preserves the canonical server ranking and today's limit", () => {
  const ranked = [
    candidate("third", { matchScore: 30 }),
    candidate("first", { matchScore: 90 }),
    candidate("second", { matchScore: 60 }),
    candidate("fourth", { matchScore: 20 }),
    candidate("fifth", { matchScore: 10 }),
    candidate("sixth", { matchScore: 5 }),
  ];

  assert.deepEqual(
    curateForMood(ranked, "surprise").map((item) => item.id),
    ["first", "second", "third", "fourth", "fifth"],
  );
});

test("a day rotates only within the strongest candidate window", () => {
  const ranked = Array.from({ length: 12 }, (_, index) =>
    candidate(String(index + 1), { matchScore: 100 - index }),
  );
  const selected = curateForMood(ranked, "surprise", 5, "2026-08-26");

  assert.equal(selected.length, 5);
  assert.ok(selected.every((item) => Number(item.id) <= 8));
});

test("the continuation set never repeats today's first five", () => {
  const ranked = Array.from({ length: 12 }, (_, index) =>
    candidate(String(index + 1), {
      matchScore: 100 - index,
      sharedAvailability: index > 3 ? ["weekday_evenings"] : [],
    }),
  );
  const first = curateForMood(ranked, "surprise", 5, "2026-08-26");
  const excluded = new Set(first.map((item) => item.id));
  const continuation = curateUnseenForMood(
    ranked,
    "tonight",
    excluded,
    5,
    "2026-08-26:continuation",
  );

  assert.equal(continuation.length, 5);
  assert.ok(continuation.every((item) => !excluded.has(item.id)));
});

test("shared availability strengthens the free-soon lens", () => {
  assert.ok(
    moodAffinity(candidate("overlap", { sharedAvailability: ["weekday_evenings"] }), "tonight") >
      moodAffinity(candidate("no-overlap"), "tonight"),
  );
});

test("a picked vibe promotes whoever actually has that interest, over the five moods", () => {
  const climber = candidate("climber", { interests: ["rock_climbing"], matchScore: 40 });
  const nonClimber = candidate("non-climber", { interests: ["books"], matchScore: 90 });
  const lens = { vibeId: "rock_climbing" };

  assert.ok(moodAffinity(climber, lens) > moodAffinity(nonClimber, lens));
  assert.deepEqual(
    curateForMood([nonClimber, climber], lens, 2).map((item) => item.id),
    ["climber", "non-climber"],
  );
});

test("distinct picked vibes rotate independently of each other and of the five moods", () => {
  const ranked = Array.from({ length: 12 }, (_, index) =>
    candidate(String(index + 1), { matchScore: 100 - index }),
  );
  const coffeeVibe = curateForMood(ranked, { vibeId: "coffee" }, 5, "2026-08-26");
  const potteryVibe = curateForMood(ranked, { vibeId: "pottery" }, 5, "2026-08-26");
  const surpriseMood = curateForMood(ranked, "surprise", 5, "2026-08-26");

  assert.equal(coffeeVibe.length, 5);
  assert.notDeepEqual(
    coffeeVibe.map((item) => item.id),
    potteryVibe.map((item) => item.id),
  );
  assert.notDeepEqual(
    coffeeVibe.map((item) => item.id),
    surpriseMood.map((item) => item.id),
  );
});
