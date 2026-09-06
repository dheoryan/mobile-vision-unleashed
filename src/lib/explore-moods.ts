export const EXPLORE_MOODS = ["surprise", "coffee", "friends", "create", "tonight"] as const;

export type ExploreMood = (typeof EXPLORE_MOODS)[number];

/**
 * A lens is either one of the five hand-tuned moods above, or a direct pick
 * from the same ~85-option interest catalogue used by onboarding and Venture
 * Vibes. The moods stay bespoke (each promotes a small hand-picked cluster of
 * signals - "create" isn't just the "art" interest); a picked vibe is the
 * general case a mood never covered: rock climbing, pottery, live comedy, and
 * everything else in the catalogue that isn't one of the five words above.
 */
export type ExploreLens = ExploreMood | { vibeId: string };

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
export function moodAffinity(candidate: MoodCandidate, lens: ExploreLens): number {
  if (typeof lens === "object") {
    const base = candidate.matchScore ?? 0;
    let affinity = base * 0.1;
    if (candidate.openVentureTitle) affinity += 8;
    // A picked vibe is a direct, explicit statement of intent - stronger than
    // any single hardcoded signal a mood checks for, since the person chose
    // exactly this rather than a mood that happens to correlate with it.
    if (candidate.interests.includes(lens.vibeId)) affinity += 50;
    return affinity;
  }

  const mood = lens;
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

/** A stable string per lens - used for the day-rotation hash below, and for
 *  a caller's own per-lens keys (e.g. React Query session keys) so distinct
 *  vibes are kept as distinct from each other as the five moods already are. */
export function lensKey(lens: ExploreLens): string {
  return typeof lens === "object" ? `vibe:${lens.vibeId}` : lens;
}

export function curateForMood<T extends MoodCandidate>(
  candidates: T[],
  lens: ExploreLens,
  limit = 5,
  dayKey?: string,
): T[] {
  const ranked = candidates
    .map((candidate, originalIndex) => ({
      candidate,
      originalIndex,
      affinity: moodAffinity(candidate, lens),
    }))
    .sort((a, b) => b.affinity - a.affinity || a.originalIndex - b.originalIndex)
    .map(({ candidate }) => candidate);

  if (!dayKey || ranked.length <= limit) return ranked.slice(0, limit);

  // Rotate only inside the strongest eight so the set feels fresh tomorrow
  // without turning a carefully ranked page into a random shuffle.
  const window = ranked.slice(0, Math.min(ranked.length, limit + 3));
  const possibleOffsets = window.length - limit + 1;
  let hash = 0;
  for (const character of `${dayKey}:${lensKey(lens)}`) {
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
  lens: ExploreLens,
  excludedIds: ReadonlySet<string>,
  limit = 5,
  dayKey?: string,
): T[] {
  return curateForMood(
    candidates.filter((candidate) => !excludedIds.has(candidate.id)),
    lens,
    limit,
    dayKey,
  );
}
