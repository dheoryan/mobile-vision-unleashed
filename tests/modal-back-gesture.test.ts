import assert from "node:assert/strict";
import test from "node:test";
import { wasPoppedPast } from "../src/hooks/use-modal-back-gesture.ts";

test("a modal with no id in the current stack has been popped past", () => {
  assert.equal(wasPoppedPast(undefined, "modal-1"), true);
  assert.equal(wasPoppedPast([], "modal-1"), true);
  assert.equal(wasPoppedPast(["modal-2"], "modal-1"), true);
});

test("a modal still listed in the current stack has not been popped past", () => {
  assert.equal(wasPoppedPast(["modal-1"], "modal-1"), false);
  assert.equal(wasPoppedPast(["modal-1", "modal-2"], "modal-1"), false);
});

test("a single back-step only closes the topmost of several nested modals", () => {
  // Three modals opened in order: A, then B on top of it, then C on top of
  // that. One back-step pops the stack from [A, B, C] to [A, B] - only C,
  // the one actually removed, should report itself popped.
  const afterOneBack = ["modal-A", "modal-B"];
  assert.equal(wasPoppedPast(afterOneBack, "modal-A"), false);
  assert.equal(wasPoppedPast(afterOneBack, "modal-B"), false);
  assert.equal(wasPoppedPast(afterOneBack, "modal-C"), true);
});
