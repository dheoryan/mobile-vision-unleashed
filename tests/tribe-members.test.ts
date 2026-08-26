import assert from "node:assert/strict";
import test from "node:test";
import { visibleTribeMembers, type TribeMemberSummary } from "../src/lib/tribe-members.ts";

const members: TribeMemberSummary[] = [
  {
    id: "offline",
    display_name: "Angga",
    handle: "angga",
    avatar_emoji: null,
    avatar_url: null,
  },
  {
    id: "online",
    display_name: "Pear",
    handle: "pear",
    avatar_emoji: null,
    avatar_url: null,
  },
  {
    id: "me",
    display_name: "WndrKid",
    handle: "wndrkid",
    avatar_emoji: null,
    avatar_url: null,
  },
];

test("member directory keeps me first, then online members", () => {
  const result = visibleTribeMembers(members, "", new Set(["online", "me"]), "me");
  assert.deepEqual(
    result.map((member) => member.id),
    ["me", "online", "offline"],
  );
});

test("member search matches names and handles without mutating source order", () => {
  const sourceIds = members.map((member) => member.id);
  assert.deepEqual(
    visibleTribeMembers(members, "PEAR", new Set(), "me").map((member) => member.id),
    ["online"],
  );
  assert.deepEqual(
    visibleTribeMembers(members, "wndr", new Set(), "me").map((member) => member.id),
    ["me"],
  );
  assert.deepEqual(
    members.map((member) => member.id),
    sourceIds,
  );
});
