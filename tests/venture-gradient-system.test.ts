import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const hellos = source("../src/components/mutuals/HelloRequestsSheet.tsx");
const ventureBoard = source("../src/components/mutuals/VentureBoard.tsx");
const ventureTicket = source("../src/components/mutuals/VentureTicket.tsx");
const composer = source("../src/components/mutuals/ChatComposer.tsx");
const messages = source("../src/components/mutuals/MessagesPanel.tsx");
const chats = source("../src/components/mutuals/ChatsScreen.tsx");
const ventures = source("../src/components/mutuals/VenturesScreen.tsx");

test("Hello tabs use the brand gradient only for the active state", () => {
  assert.match(hellos, /active[\s\S]{0,120}bg-meutuals-gradient text-white/);
  assert.match(hellos, /active \? "bg-white\/20 text-white"/);
});

test("Venture entry actions use the MEUTUALS gradient with white content", () => {
  assert.match(ventureBoard, /Open party chat/);
  assert.match(ventureBoard, /Request this Venture/);
  assert.ok((ventureBoard.match(/bg-meutuals-gradient[^"]*text-white/g) ?? []).length >= 2);
  assert.match(ventureTicket, /Open party chat/);
  assert.ok((ventureTicket.match(/bg-meutuals-gradient[^"]*text-white/g) ?? []).length >= 2);
});

test("only the Venture chat composer opts into the gradient send action", () => {
  assert.match(composer, /gradientAction[\s\S]{0,220}bg-meutuals-gradient text-white/);
  assert.match(
    messages,
    /<ChatComposer[\s\S]{0,400}accentColor="var\(--color-primary\)"[\s\S]{0,80}gradientAction/,
  );
});

test("Venture completion and inbox category icons are gradient with white icons", () => {
  assert.match(messages, /rounded-full bg-meutuals-gradient text-white[\s\S]{0,100}<UsersIcon/);
  assert.equal((chats.match(/rounded-2xl bg-meutuals-gradient text-white/g) ?? []).length, 2);
});

test("Venture creation and the Active count indicator use the gradient with white foregrounds", () => {
  assert.match(ventures, /formOpen[\s\S]{0,500}bg-meutuals-gradient text-white/);
  assert.match(
    ventures,
    /bg-meutuals-gradient px-1\.5 font-mono text-\[9px\] font-bold text-white"[\s\S]{0,60}\{count\}/,
  );
  // History is a closed log with nothing left to act on - the same count
  // badge there was noise, so only the Active tab carries it.
  assert.match(ventures, /tab === "active" && count > 0 && \([\s\S]{0,400}bg-meutuals-gradient/);
});

test("Venture Audience choice and Vibe tags follow the same gradient (all Tribes) vs. Tribe-color (Tribe-only) rule", () => {
  assert.match(ventures, /title="All Tribes"[\s\S]{0,80}gradient/);
  assert.match(ventures, /accentColor=\{primaryTribe\.colorVar\}/);
  assert.match(ventures, /scope === "all" && "bg-meutuals-gradient"/);
});
