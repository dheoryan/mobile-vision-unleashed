import assert from "node:assert/strict";
import test from "node:test";
import { readAppNavigation } from "../src/lib/app-navigation.ts";

test("reads a valid root-tab navigation snapshot", () => {
  assert.deepEqual(readAppNavigation({ __meutualsNavigation: { tab: "chats" } }), { tab: "chats" });
});

test("preserves the layer needed to restore a Tribe chat", () => {
  const snapshot = {
    tab: "chats" as const,
    layer: { kind: "tribe" as const, tribeId: "cat" as const },
  };
  assert.deepEqual(readAppNavigation({ __meutualsNavigation: snapshot }), snapshot);
});

test("ignores unrelated or invalid browser history state", () => {
  assert.equal(readAppNavigation(null), null);
  assert.equal(readAppNavigation({ key: "router-owned" }), null);
  assert.equal(readAppNavigation({ __meutualsNavigation: { tab: "unknown" } }), null);
});
