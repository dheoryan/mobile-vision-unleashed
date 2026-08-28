import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rootSource = readFileSync(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
const composerSource = readFileSync(
  new URL("../src/components/mutuals/ChatComposer.tsx", import.meta.url),
  "utf8",
);
const tribeSource = readFileSync(
  new URL("../src/components/mutuals/TribeScreen.tsx", import.meta.url),
  "utf8",
);
const messagesSource = readFileSync(
  new URL("../src/components/mutuals/MessagesPanel.tsx", import.meta.url),
  "utf8",
);

test("mobile chats opt into content resize and track the visual viewport", () => {
  assert.match(rootSource, /interactive-widget=resizes-content/);
  assert.match(tribeSource, /useVisualViewport\(true\)/);
  assert.match(messagesSource, /useVisualViewport\(open\)/);
});

test("chat input stays at least 16px on mobile to prevent focus zoom", () => {
  assert.match(composerSource, /text-base[\s\S]*sm:text-sm/);
});

test("Tribe room no longer displays the You're home label", () => {
  assert.doesNotMatch(tribeSource, /You(?:'|’)re home/i);
});
