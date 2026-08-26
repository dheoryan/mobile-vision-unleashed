import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAX_AVATAR_IMAGE_BYTES, avatarFileIssue } from "../src/lib/avatar-file.ts";

test("accepts Android gallery files with generic MIME metadata", () => {
  assert.equal(
    avatarFileIssue({ name: "camera-photo.JPG", type: "application/octet-stream", size: 1024 }),
    null,
  );
  assert.equal(avatarFileIssue({ name: "gallery.webp", type: "", size: 1024 }), null);
});

test("rejects non-images and oversized avatar files", () => {
  assert.equal(avatarFileIssue({ name: "document.pdf", type: "", size: 1024 }), "not-image");
  assert.equal(
    avatarFileIssue({
      name: "large.jpg",
      type: "image/jpeg",
      size: MAX_AVATAR_IMAGE_BYTES + 1,
    }),
    "too-large",
  );
});

test("profile photo controls directly activate one non-display-none file input", () => {
  const editProfileSource = readFileSync(
    new URL("../src/components/mutuals/ProfileScreen.tsx", import.meta.url),
    "utf8",
  );
  const onboardingSource = readFileSync(
    new URL("../src/components/mutuals/Onboarding.tsx", import.meta.url),
    "utf8",
  );

  for (const source of [editProfileSource, onboardingSource]) {
    assert.match(source, /avatarInputRef = useRef<HTMLInputElement>\(null\)/);
    assert.match(source, /input\.click\(\)/);
    assert.match(source, /ref=\{avatarInputRef\}/);
    assert.doesNotMatch(source, /<Camera\b/);

    const avatarInput = source.match(/<input\s+ref=\{avatarInputRef\}[\s\S]*?\/>/)?.[0] ?? "";
    assert.ok(avatarInput);
    assert.doesNotMatch(avatarInput, /className="hidden"/);
  }

  assert.match(editProfileSource, /"Change photo"/);
  assert.match(onboardingSource, /"Add photo"/);
});
