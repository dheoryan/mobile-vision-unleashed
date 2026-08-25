import assert from "node:assert/strict";
import test from "node:test";
import { curateForMood, moodAffinity, type MoodCandidate } from "../src/lib/explore-moods.ts";

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
