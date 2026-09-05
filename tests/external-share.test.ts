import assert from "node:assert/strict";
import test from "node:test";
import { performExternalShare } from "../src/lib/external-share.ts";

test("native completion counts once and does not also copy", async () => {
  assert.equal(
    await performExternalShare("url", {
      share: async () => {},
      copy: async () => assert.fail("duplicate path"),
    }),
    "native",
  );
});
test("dismissed picker neither counts nor silently copies", async () => {
  const error = new Error("cancelled");
  error.name = "AbortError";
  assert.equal(
    await performExternalShare("url", {
      share: async () => {
        throw error;
      },
      copy: async () => assert.fail("cancelled"),
    }),
    null,
  );
});
test("copy must actually succeed before it can count", async () => {
  await assert.rejects(performExternalShare("url", {}), /unavailable/);
  await assert.rejects(
    performExternalShare("url", {
      copy: async () => {
        throw new Error("denied");
      },
    }),
    /denied/,
  );
  assert.equal(await performExternalShare("url", { copy: async () => {} }), "clipboard");
});
test("native failure may fall back to a successful copy", async () => {
  assert.equal(
    await performExternalShare("url", {
      share: async () => {
        throw new Error("unavailable");
      },
      copy: async () => {},
    }),
    "clipboard",
  );
});
