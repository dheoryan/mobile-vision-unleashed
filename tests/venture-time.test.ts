import assert from "node:assert/strict";
import test from "node:test";
import {
  dayChoices,
  endTimeForDuration,
  minutesUntilEnd,
  periodDefaultTime,
  planTimeLabel,
  todayKey,
} from "../src/lib/venture-time.ts";

test("Venture scheduling shortcuts stay unique and human-readable", () => {
  const choices = dayChoices();
  assert.equal(new Set(choices.map((choice) => choice.value)).size, choices.length);
  assert.equal(periodDefaultTime("morning"), "10:00");
  assert.equal(periodDefaultTime("afternoon"), "14:00");
  assert.equal(periodDefaultTime("evening"), "19:00");
  assert.match(planTimeLabel(todayKey(2), "afternoon"), /Afternoon$/);
  assert.doesNotMatch(planTimeLabel(todayKey(2), "afternoon"), /^\d{4}-\d{2}-\d{2}/);
});

test("Custom Venture ends resolve forward and reject a zero-length schedule", () => {
  assert.equal(minutesUntilEnd("2026-08-29", "19:00", "22:30"), 210);
  assert.equal(minutesUntilEnd("2026-08-29", "22:00", "01:00"), 180);
  assert.equal(minutesUntilEnd("2026-08-29", "19:00", "19:00"), null);
  assert.equal(endTimeForDuration("2026-08-29", "19:00", 180), "22:00");
});
