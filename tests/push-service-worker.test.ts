import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceWorkerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const pushSubscribeSource = readFileSync(
  new URL("../src/lib/push-subscribe.ts", import.meta.url),
  "utf8",
);

test("optional offline caching cannot prevent the push worker from installing", () => {
  assert.match(serviceWorkerSource, /Promise\.allSettled/);
  assert.doesNotMatch(serviceWorkerSource, /cache\.addAll\(PRECACHE\)/);
  assert.match(serviceWorkerSource, /const OFFLINE_URL = "\/offline\.html"/);
});

test("push enable repairs a registration that has no active worker", () => {
  assert.match(pushSubscribeSource, /for \(let attempt = 0; attempt < 2;/);
  assert.match(pushSubscribeSource, /worker\.addEventListener\("statechange"/);
  assert.match(pushSubscribeSource, /registration\.unregister\(\)/);
  assert.doesNotMatch(pushSubscribeSource, /navigator\.serviceWorker\.ready/);
});
