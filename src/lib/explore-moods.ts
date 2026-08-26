export const EXPLORE_MOODS = ["surprise", "coffee", "friends", "create", "tonight"] as const;

export type ExploreMood = (typeof EXPLORE_MOODS)[number];

export interface MoodCandidate {
  id: string;
  interests: string[];
  socialIntents: string[];
  availability: string[];
  sharedAvailability?: string[];
  distanceBand?: string | null;
  matchScore?: number;
  openVentureTitle?: string | null;
}

const includesAny = (values: string[], wanted: ReadonlySet<string>) =>
  values.some((value) => wanted.has(value));
const COFFEE_INTENTS = new Set(["casual_hangouts", "make_friends"]);
const CREATIVE_INTERESTS = new Set(["art", "music", "tech", "business"]);
const TONIGHT_AVAILABILITY = new Set(["weekday_evenings", "spontaneous"]);

/**
 * A transparent client-side lens over the server's canonical Explore ranking.
 * It reorders the already-authorized candidate page; it never gates location,
 * changes visibility, or permanently rejects somebody.
 */
export function moodAffinity(candidate: MoodCandidate, mood: ExploreMood): number {
  const base = candidate.matchScore ?? 0;
  if (mood === "surprise") return base;

  let affinity = base * 0.1;
  if (candidate.openVentureTitle) affinity += 8;

  if (mood === "coffee") {
    if (candidate.interests.includes("coffee")) affinity += 40;
    if (includesAny(candidate.socialIntents, COFFEE_INTENTS)) {
      affinity += 22;
    }
    if (candidate.distanceBand) affinity += 18;
  }

  if (mood === "friends") {
    if (candidate.socialIntents.includes("make_friends")) affinity += 48;
    if (candidate.socialIntents.includes("casual_hangouts")) affinity += 22;
    if (candidate.availability.includes("spontaneous")) affinity += 14;
  }

  if (mood === "create") {
    if (candidate.socialIntents.includes("creative_collab")) affinity += 48;
    if (includesAny(candidate.interests, CREATIVE_INTERESTS)) {
      affinity += 24;
    }
  }

  if (mood === "tonight") {
    if (candidate.interests.includes("nightlife")) affinity += 34;
    if (includesAny(candidate.availability, TONIGHT_AVAILABILITY)) {
      affinity += 30;
    }
    if (candidate.sharedAvailability?.length) affinity += 28;
    if (candidate.openVentureTitle) affinity += 18;
  }

  return affinity;
}

export function curateForMood<T extends MoodCandidate>(
  candidates: T[],
  mood: ExploreMood,
  limit = 5,
  dayKey?: string,
): T[] {
  const ranked = candidates
    .map((candidate, originalIndex) => ({
      candidate,
      originalIndex,
      affinity: moodAffinity(candidate, mood),
    }))
    .sort((a, b) => b.affinity - a.affinity || a.originalIndex - b.originalIndex)
    .map(({ candidate }) => candidate);

  if (!dayKey || ranked.length <= limit) return ranked.slice(0, limit);

  // Rotate only inside the strongest eight so the set feels fresh tomorrow
  // without turning a carefully ranked page into a random shuffle.
  const window = ranked.slice(0, Math.min(ranked.length, limit + 3));
  const possibleOffsets = window.length - limit + 1;
  let hash = 0;
  for (const character of `${dayKey}:${mood}`) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  const offset = hash % possibleOffsets;
  return window.slice(offset, offset + limit);
}

/**
 * Produces a second consideration set without recycling anyone from the first.
 * Exclusion happens before mood ranking so a different lens cannot quietly
 * reintroduce the same strongest profiles.
 */
export function curateUnseenForMood<T extends MoodCandidate>(
  candidates: T[],
  mood: ExploreMood,
  excludedIds: ReadonlySet<string>,
  limit = 5,
  dayKey?: string,
): T[] {
  return curateForMood(
    candidates.filter((candidate) => !excludedIds.has(candidate.id)),
    mood,
    limit,
    dayKey,
  );
}
