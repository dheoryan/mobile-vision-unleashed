import type { TribeId } from "@/lib/mutuals-data";
import { planTimeLabel, type PlanPeriod } from "./venture-time.ts";

export type TribeRoomKind = "pulse_answer" | "plan" | "venture";
export type TribeRoomReaction =
  | "spark"
  | "interested"
  | "heart"
  | "laugh"
  | "support"
  | "time_1"
  | "time_2"
  | "time_3";

export const emptyTribeRoomReactions = (): Record<TribeRoomReaction, number> => ({
  spark: 0,
  interested: 0,
  heart: 0,
  laugh: 0,
  support: 0,
  time_1: 0,
  time_2: 0,
  time_3: 0,
});
export type TribeRoomMetadataValue =
  | string
  | number
  | boolean
  | null
  | TribeRoomMetadata
  | TribeRoomMetadataValue[];
export interface TribeRoomMetadata {
  [key: string]: TribeRoomMetadataValue;
}

export interface TribeRoomAuthor {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
}

export interface TribeRoomItem {
  id: string;
  tribe_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
  room_kind: TribeRoomKind;
  room_metadata: TribeRoomMetadata;
  author: TribeRoomAuthor | null;
  reactions: Record<TribeRoomReaction, number>;
  my_reactions: TribeRoomReaction[];
}

export interface TribeVentureDraft {
  sourceMessageId: string;
  dbTribeId: string;
  tribeId: TribeId;
  title: string;
  note: string;
  whenLabel: string;
  timeOptions: TribePlanTimeOptionWithVotes[];
  area: string;
  maxSlots: number;
}

export type TribePlanTimeKey = "time_1" | "time_2" | "time_3";

export interface TribePlanTimeOption {
  key: TribePlanTimeKey;
  day: string;
  period: PlanPeriod;
}

export interface TribePlanTimeOptionWithVotes extends TribePlanTimeOption {
  label: string;
  votes: number;
}

interface PulsePrompt {
  key: string;
  question: string;
  hint: string;
}

const SHARED_PROMPTS: PulsePrompt[] = [
  {
    key: "tiny-plan",
    question: "What tiny plan would get you out of the house this week?",
    hint: "A coffee, a walk, a gallery, a late bite—keep it easy.",
  },
  {
    key: "teach-us",
    question: "What could you teach the room in twenty minutes?",
    hint: "A skill, a ritual, a shortcut, or something oddly specific.",
  },
  {
    key: "need-company",
    question: "What would be better with two or three people beside you?",
    hint: "Name the moment. The room can help turn it into a plan.",
  },
  {
    key: "local-find",
    question: "What local place deserves a small crowd this week?",
    hint: "Share the area, not a private address.",
  },
  {
    key: "try-once",
    question: "What have you wanted to try once, but not alone?",
    hint: "Low stakes is good. Curiosity is enough.",
  },
];

const TRIBE_PROMPTS: Record<TribeId, PulsePrompt[]> = {
  wolf: [
    {
      key: "wolf-move",
      question: "What kind of movement would feel good this week?",
      hint: "A run, a lift, a walk, or active recovery all count.",
    },
  ],
  koi: [
    {
      key: "koi-slow",
      question: "Where could the room slow down together this week?",
      hint: "A bookshop, a quiet café, a garden, or a thoughtful conversation.",
    },
  ],
  cat: [
    {
      key: "cat-make",
      question: "What should Studio Cat make, hear, or see together next?",
      hint: "A sketch night, listening session, exhibition, or tiny collaboration.",
    },
  ],
  owl: [
    {
      key: "owl-after-dark",
      question: "What conversation is worth staying up for this week?",
      hint: "Give it a theme and the room can give it a table.",
    },
  ],
  bee: [
    {
      key: "bee-unblock",
      question: "What could this room help you finally unblock?",
      hint: "A portfolio, a pitch, a job question, or one focused work session.",
    },
  ],
};

function localDateKey(now: Date) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

export function dailyPulse(tribeId: TribeId, now = new Date()) {
  const prompts = [...TRIBE_PROMPTS[tribeId], ...SHARED_PROMPTS];
  const date = localDateKey(now);
  const prompt = prompts[hash(`${tribeId}:${date}`) % prompts.length];
  return { ...prompt, id: `${date}:${tribeId}:${prompt.key}` };
}

export function roomMetadataString(metadata: TribeRoomMetadata, key: string, fallback = "") {
  const value = metadata[key];
  return typeof value === "string" ? value : fallback;
}

export function roomMetadataNumber(metadata: TribeRoomMetadata, key: string, fallback: number) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const TIME_KEYS: TribePlanTimeKey[] = ["time_1", "time_2", "time_3"];
const PLAN_PERIODS: PlanPeriod[] = ["morning", "afternoon", "evening"];

export function roomMetadataTimeOptions(
  metadata: TribeRoomMetadata,
  reactions: Record<TribeRoomReaction, number> = emptyTribeRoomReactions(),
): TribePlanTimeOptionWithVotes[] {
  const value = metadata.time_options;
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const key = entry.key;
    const day = entry.day;
    const period = entry.period;
    if (
      index > 2 ||
      typeof key !== "string" ||
      !TIME_KEYS.includes(key as TribePlanTimeKey) ||
      typeof day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      typeof period !== "string" ||
      !PLAN_PERIODS.includes(period as PlanPeriod)
    ) {
      return [];
    }
    const typedKey = key as TribePlanTimeKey;
    const typedPeriod = period as PlanPeriod;
    return [
      {
        key: typedKey,
        day,
        period: typedPeriod,
        label: planTimeLabel(day, typedPeriod),
        votes: reactions[typedKey],
      },
    ];
  });
}
