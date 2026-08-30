import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getVisualViewportMetrics } from "../src/hooks/use-visual-viewport.ts";

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
const viewportSource = readFileSync(
  new URL("../src/hooks/use-visual-viewport.ts", import.meta.url),
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

test("visual viewport metrics distinguish keyboard occlusion from browser chrome", () => {
  assert.deepEqual(
    getVisualViewportMetrics({
      stableHeight: 844,
      layoutHeight: 844,
      visualHeight: 500,
      offsetTop: 44,
    }),
    { height: 500, offsetTop: 44, bottomInset: 300, keyboardOpen: true },
  );
  assert.equal(
    getVisualViewportMetrics({
      stableHeight: 844,
      layoutHeight: 844,
      visualHeight: 780,
      offsetTop: 0,
    }).keyboardOpen,
    false,
  );
});

test("chat shells use one keyboard-aware safe-area owner", () => {
  assert.match(composerSource, /keyboardOpen \? "pb-2"/);
  assert.match(composerSource, /safe-area-inset-bottom/);
  assert.match(messagesSource, /keyboardOpen=\{visualViewport\.keyboardOpen\}/);
  assert.match(messagesSource, /pt-\[env\(safe-area-inset-top\)\]/);
  assert.match(tribeSource, /keyboardOpen=\{visualViewport\.keyboardOpen\}/);
  assert.doesNotMatch(tribeSource, /<main className="[^"]*pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(viewportSource, /bottomInset/);
});

test("Tribe room no longer displays the You're home label", () => {
  assert.doesNotMatch(tribeSource, /You(?:'|’)re home/i);
});
