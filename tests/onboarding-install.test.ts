import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const route = read("src/routes/index.tsx");
const install = read("src/components/mutuals/OnboardingInstall.tsx");
const pushPrompt = read("src/components/mutuals/PushPromptModal.tsx");

test("installation is an optional post-profile onboarding step", () => {
  assert.match(route, /if \(profile && showOnboardingInstall\)/);
  assert.match(route, /if \(!isStandalonePwa\(\)\) setShowOnboardingInstall\(true\)/);
  assert.match(install, /Optional final touch/);
  assert.match(install, /Continue to MEUTUALS/);
  assert.match(install, /install later in Settings/);
  assert.match(install, /data-onboarding-install/);
  assert.match(pushPrompt, /querySelector\("\[data-onboarding-install\]"\)/);
});

test("the install step adapts to iOS, Android, desktop, and native install availability", () => {
  for (const capability of [
    "isIosSafari()",
    "isIosThirdPartyBrowser()",
    "isAndroid()",
    "isStandalonePwa()",
    "canInstallNow()",
    "onInstallAvailabilityChange",
    "triggerInstallPrompt()",
  ]) {
    assert.match(install, new RegExp(capability.replace(/[()]/g, "\\$&")));
  }
  assert.match(install, /Tap Share in Safari/);
  assert.match(install, /Choose Add to Home Screen/);
  assert.match(install, /Choose Install app/);
  assert.match(install, /Add to Dock/);
});
