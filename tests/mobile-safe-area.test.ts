import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sharedHeaderSource = readFileSync(
  new URL("../src/components/mutuals/Shared.tsx", import.meta.url),
  "utf8",
);

test("shared app header keeps controls below the iOS Home Screen status bar", () => {
  assert.match(
    sharedHeaderSource,
    /<header className="[^"]*pt-\[env\(safe-area-inset-top\)\][^"]*">/,
  );
});
