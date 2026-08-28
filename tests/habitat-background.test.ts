import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const habitatRule = styles.match(/\.bg-habitat\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? "";

test("habitat background keeps one restrained top glow and a neutral bottom", () => {
  assert.match(habitatRule, /at 90% -10%/);
  assert.match(habitatRule, /var\(--color-primary\) 7%/);
  assert.equal((habitatRule.match(/radial-gradient/g) ?? []).length, 1);
  assert.doesNotMatch(habitatRule, /at 0% 100%/);
  assert.match(habitatRule, /var\(--color-background\)/);
});
