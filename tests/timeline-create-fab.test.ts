import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const timeline = source("../src/components/mutuals/TimelineScreen.tsx");
const composer = source("../src/components/mutuals/ComposerModal.tsx");
const repostAudience = source("../src/components/mutuals/RepostAudienceChoices.tsx");
const styles = source("../src/styles.css");

test("Timeline creation is a safe-area-aware plus-only FAB, not a header action", () => {
  assert.match(timeline, /bottom-\[calc\(5\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(timeline, /h-14 w-14/);
  assert.match(timeline, /<Plus className="h-6 w-6"/);
  assert.match(timeline, /aria-label=\{tab === "global" \? "Post to The Wild"/);
  assert.doesNotMatch(timeline, /accent="var\(--color-primary\)"[\s\S]{0,120}action=/);
});

test("Tribe and Wild creation surfaces use distinct audience color systems", () => {
  assert.match(timeline, /tab === "global" && "bg-meutuals-gradient"/);
  assert.match(timeline, /tab === "tribe" \? \{ backgroundColor: tribe\.colorVar \}/);
  assert.match(composer, /effectiveAudience === "all" && "bg-meutuals-gradient"/);
  assert.match(composer, /effectiveAudience === "tribe" \? \{ backgroundColor: tribe\.colorVar \}/);
  assert.match(repostAudience, /allowWild[\s\S]*"bg-meutuals-gradient text-primary-foreground"/);
});

test("brand system tokens stay separate from Tribe and semantic warning colors", () => {
  assert.match(styles, /--brand-solid: #ff006e/);
  assert.match(styles, /--brand-gradient: linear-gradient\(100deg, #ff00b8/);
  assert.match(styles, /--primary: var\(--brand-solid\)/);
  assert.match(styles, /--warning: oklch\(0\.78 0\.12 80\)/);
  assert.match(styles, /\.bg-meutuals-gradient/);
});
