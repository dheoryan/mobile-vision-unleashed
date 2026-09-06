import assert from "node:assert/strict";
import test from "node:test";
import {
  ventureAcceptsRequests,
  ventureLifecycle,
  ventureStateLabel,
} from "../src/lib/venture-time.ts";

const now = new Date("2026-09-06T12:00:00.000Z");

test("one lifecycle rule distinguishes scheduled, live, completed, and cancelled Ventures", () => {
  assert.equal(
    ventureLifecycle(
      {
        status: "open",
        starts_at: "2026-09-06T13:00:00.000Z",
        ends_at: "2026-09-06T15:00:00.000Z",
      },
      now,
    ),
    "scheduled",
  );
  assert.equal(
    ventureLifecycle(
      {
        status: "open",
        starts_at: "2026-09-06T11:00:00.000Z",
        ends_at: "2026-09-06T13:00:00.000Z",
      },
      now,
    ),
    "happening",
  );
  assert.equal(
    ventureLifecycle(
      {
        status: "open",
        starts_at: "2026-09-06T09:00:00.000Z",
        ends_at: "2026-09-06T11:00:00.000Z",
      },
      now,
    ),
    "completed",
  );
  assert.equal(
    ventureLifecycle(
      {
        status: "closed",
        starts_at: "2026-09-07T09:00:00.000Z",
        ends_at: "2026-09-07T11:00:00.000Z",
        cancelled_at: "2026-09-06T10:00:00.000Z",
      },
      now,
    ),
    "cancelled",
  );
});

test("requests close at start and urgency labels remain consistent", () => {
  const upcoming = {
    status: "open" as const,
    starts_at: "2026-09-06T13:00:00.000Z",
    ends_at: "2026-09-06T15:00:00.000Z",
  };
  assert.equal(ventureAcceptsRequests(upcoming, now), true);
  assert.equal(ventureStateLabel(upcoming, now), "Starts soon");

  const happening = {
    status: "open" as const,
    starts_at: "2026-09-06T11:00:00.000Z",
    ends_at: "2026-09-06T13:00:00.000Z",
  };
  assert.equal(ventureAcceptsRequests(happening, now), false);
  assert.equal(ventureStateLabel(happening, now), "Happening now");
});
