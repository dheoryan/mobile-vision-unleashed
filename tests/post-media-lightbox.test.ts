import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/mutuals/PostMediaLightbox.tsx", import.meta.url),
  "utf8",
);

test("lightbox controls are outside the pointer-capturing image surface", () => {
  const gestureSurfaceStart = source.indexOf("data-lightbox-gesture-surface");
  const gestureSurfaceEnd = source.indexOf("</div>", gestureSurfaceStart);
  const topControls = source.indexOf('data-lightbox-controls="top"');
  const bottomControls = source.indexOf('data-lightbox-controls="bottom"');

  assert.notEqual(gestureSurfaceStart, -1);
  assert.notEqual(gestureSurfaceEnd, -1);
  assert.ok(topControls > gestureSurfaceEnd);
  assert.ok(bottomControls > gestureSurfaceEnd);
});

test("the close control remains a full touch target above the image layer", () => {
  assert.match(source, /data-lightbox-controls="top"[\s\S]*?className="[^"]*z-10/);
  assert.match(
    source,
    /onClick=\{close\}[\s\S]*?className="[^"]*h-11 w-11[^"]*"[\s\S]*?aria-label="Close photo"/,
  );
});
