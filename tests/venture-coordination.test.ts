import assert from "node:assert/strict";
import test from "node:test";
import {
  arrivalStatusLabel,
  venturePlaceLabel,
  ventureReminderLabel,
} from "../src/lib/venture-coordination.ts";

test("Venture reminder appears only during the useful two-hour window", () => {
  const now = new Date("2026-08-26T10:00:00.000Z");
  assert.equal(
    ventureReminderLabel(
      { starts_at: "2026-08-26T11:30:00.000Z", ends_at: "2026-08-26T13:00:00.000Z" },
      now,
    ),
    "Starts in 1 hr 30 min",
  );
  assert.equal(
    ventureReminderLabel(
      { starts_at: "2026-08-26T13:00:01.000Z", ends_at: "2026-08-26T14:00:00.000Z" },
      now,
    ),
    null,
  );
  assert.equal(
    ventureReminderLabel(
      { starts_at: "2026-08-26T09:30:00.000Z", ends_at: "2026-08-26T11:00:00.000Z" },
      now,
    ),
    "Happening now",
  );
});

test("Venture coordination labels use host-authored place text", () => {
  assert.equal(
    venturePlaceLabel({
      venue: { id: "venue", host_label: "Kopi Kalyan", area: "Kemang", google_place_id: null },
    }),
    "Kopi Kalyan · Kemang",
  );
  assert.equal(arrivalStatusLabel("running_late"), "Running late");
});
