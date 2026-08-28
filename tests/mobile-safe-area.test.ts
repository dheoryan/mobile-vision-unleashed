import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sharedHeaderSource = readFileSync(
  new URL("../src/components/mutuals/Shared.tsx", import.meta.url),
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
