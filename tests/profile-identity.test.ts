import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ownProfileSource = readFileSync(
  new URL("../src/components/mutuals/ProfileScreen.tsx", import.meta.url),
  "utf8",
);
const publicProfileSource = readFileSync(
  new URL("../src/routes/u.$handle.tsx", import.meta.url),
  "utf8",
);

test("own and public profile identity blocks show a normalized @handle", () => {
  for (const source of [ownProfileSource, publicProfileSource]) {
    assert.match(source, /profile\.handle && \(/);
    assert.match(source, /@\{profile\.handle\.replace\(\/\^@\/, ""\)\}/);
    assert.match(source, /truncate text-sm font-medium text-muted-foreground/);
  }
});
