import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(target);
      return /\.(tsx?|css)$/.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

test("app copy has no explicit microtype or weak white overlay text", async () => {
  const roots = ["src/components", "src/routes"];
  const files = (await Promise.all(roots.map(sourceFiles))).flat();
  const violations: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/\bMeutuals\b/.test(source)) violations.push(`${file} uses inconsistent brand casing`);
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      const pixelSizes = [...line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)];
      if (pixelSizes.some((match) => Number(match[1]) < 12))
        violations.push(`${file}:${index + 1} uses text below 12px`);
      if (/text-white\/(?:[0-5]?\d|6[0-5])(?:\D|$)/.test(line)) {
        violations.push(`${file}:${index + 1} uses white text below 70% opacity`);
      }
      if (/\btext-accent(?!-)/.test(line)) {
        violations.push(`${file}:${index + 1} uses the dark raw accent for text`);
      }
    });
  }

  assert.deepEqual(violations, []);
});

test("the shared uppercase label style stays readable", async () => {
  const styles = await readFile("src/styles.css", "utf8");
  assert.match(
    styles,
    /\.label-mono\s*\{[^}]*font-size:\s*12px;[^}]*letter-spacing:\s*0\.12em;/s,
  );
});
