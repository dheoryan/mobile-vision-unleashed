import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sharedHeaderSource = readFileSync(
  new URL("../src/components/mutuals/Shared.tsx", import.meta.url),
  "utf8",
);
const bottomNavSource = readFileSync(
  new URL("../src/components/mutuals/BottomNav.tsx", import.meta.url),
  "utf8",
);

test("shared app header keeps controls below the iOS Home Screen status bar", () => {
  assert.match(sharedHeaderSource, /pt-\[env\(safe-area-inset-top\)\]/);
});

test("shared app header uses a visible WebKit-compatible glass blur", () => {
  assert.match(sharedHeaderSource, /background:\s*"color-mix\([^\n]+56%/);
  assert.match(sharedHeaderSource, /backdropFilter:\s*"blur\(24px\) saturate\(160%\)"/);
  assert.match(sharedHeaderSource, /WebkitBackdropFilter:\s*"blur\(24px\) saturate\(160%\)"/);
});

test("bottom navigation matches the shared header glass treatment", () => {
  for (const source of [sharedHeaderSource, bottomNavSource]) {
    assert.match(source, /background:\s*"color-mix\([^\n]+56%/);
    assert.match(source, /backdropFilter:\s*"blur\(24px\) saturate\(160%\)"/);
    assert.match(source, /WebkitBackdropFilter:\s*"blur\(24px\) saturate\(160%\)"/);
  }
  assert.match(bottomNavSource, /pb-\[max\(env\(safe-area-inset-bottom\),0\.4rem\)\]/);
});

test("bottom navigation uses the same Timeline name as the screen header", () => {
  assert.match(bottomNavSource, /key: "feed", label: "Timeline"/);
  assert.doesNotMatch(bottomNavSource, /label: "Feed"/);
});
