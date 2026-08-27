import assert from "node:assert/strict";
import test from "node:test";
import {
  chatGroupPosition,
  chatGroupSpacing,
  endsChatGroup,
  startsChatGroup,
} from "../src/lib/chat-grouping.ts";

const at = (minutes: number) => new Date(Date.UTC(2026, 7, 27, 10, minutes)).toISOString();

test("consecutive messages from one sender become a compact group", () => {
  const messages = [0, 1, 2].map((minute) => ({ sender_id: "a", created_at: at(minute) }));
  assert.deepEqual(
    messages.map((_, index) => chatGroupPosition(messages, index)),
    ["start", "middle", "end"],
  );
});

test("sender changes and long pauses break groups", () => {
  const messages = [
    { sender_id: "a", created_at: at(0) },
    { sender_id: "b", created_at: at(1) },
    { sender_id: "b", created_at: at(17) },
  ];
  assert.deepEqual(
    messages.map((_, index) => chatGroupPosition(messages, index)),
    ["single", "single", "single"],
  );
});

test("a conversational pause still keeps nearby messages visibly connected", () => {
  const messages = [
    { sender_id: "a", created_at: at(0) },
    { sender_id: "a", created_at: at(14) },
  ];
  assert.deepEqual(
    messages.map((_, index) => chatGroupPosition(messages, index)),
    ["start", "end"],
  );
  assert.equal(chatGroupSpacing("start"), "mt-4");
  assert.equal(chatGroupSpacing("end"), "mt-1");
});

test("system rows interrupt a sender group", () => {
  const messages = [
    { sender_id: "a", created_at: at(0), system: false },
    { sender_id: "system", created_at: at(1), system: true },
    { sender_id: "a", created_at: at(2), system: false },
  ];
  const isSystem = (message: (typeof messages)[number]) => message.system;
  assert.deepEqual(
    messages.map((_, index) => chatGroupPosition(messages, index, isSystem)),
    ["single", "single", "single"],
  );
  assert.equal(startsChatGroup("start"), true);
  assert.equal(endsChatGroup("end"), true);
});
