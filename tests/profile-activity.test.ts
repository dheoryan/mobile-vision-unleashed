import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const publicProfile = read("src/routes/u.$handle.tsx");
const ownProfile = read("src/components/mutuals/ProfileScreen.tsx");
const tabs = read("src/components/mutuals/ProfileActivityTabs.tsx");
const postFunctions = read("src/lib/posts.functions.ts");
const ventureFunctions = read("src/lib/ventures.functions.ts");
const ventureHistory = read("src/components/mutuals/ProfileVentureHistory.tsx");

test("own and public profiles share Signals, Reposts, and Ventures tabs", () => {
  for (const label of ["Signals", "Reposts", "Ventures"]) {
    assert.match(tabs, new RegExp(`label: "${label}"`));
  }
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /aria-selected=\{active\}/);
  assert.match(ownProfile, /<ProfileActivityTabs value=\{gridTab\}/);
  assert.match(publicProfile, /<ProfileActivityTabs value=\{activityTab\}/);
});

test("public repost history stays behind post RLS and keeps repost chronology", () => {
  assert.match(postFunctions, /listRepostedPostsByAuthor/);
  assert.match(postFunctions, /\.select\(`created_at, posts!inner\(\$\{POST_COLS\}\)`\)/);
  assert.match(postFunctions, /\.eq\("user_id", authorId\)/);
  assert.match(postFunctions, /profile_activity_at: repostRows\[index\]\?\.created_at/);
  assert.match(publicProfile, /useRepostedPostsByAuthor\(profile\?\.id \?\? null\)/);
});

test("profile Venture history uses viewer RLS and exposes no private coordination data", () => {
  const start = ventureFunctions.indexOf("export const listProfileVentureHistory");
  const end = ventureFunctions.indexOf("export const listVentureInviteCandidates", start);
  const source = ventureFunctions.slice(start, end);

  assert.match(source, /const \{ supabase \} = context/);
  assert.match(source, /\.eq\("user_id", data\.profile_id\)/);
  assert.match(source, /\.eq\("applicant_id", data\.profile_id\)/);
  assert.match(source, /\.eq\("status", "accepted"\)/);
  assert.doesNotMatch(source, /supabaseAdmin/);
  assert.doesNotMatch(source, /fetchPrivateVenues/);
  assert.doesNotMatch(source, /arrival_details/);
});

test("Venture history separates upcoming and past entries and labels participation", () => {
  assert.match(ventureHistory, />\s*Upcoming/);
  assert.match(ventureHistory, />\s*Past ventures/);
  assert.match(ventureHistory, /profile_role === "hosted" \? "Hosted" : "Joined"/);
  assert.match(publicProfile, /No Venture history is visible to you yet\./);
});
