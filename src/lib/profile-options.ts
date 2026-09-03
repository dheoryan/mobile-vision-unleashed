import { type TribeId } from "@/lib/mutuals-data";

/**
 * Every interest that maps to a Tribe carries that Tribe's id - drawn from
 * each Tribe's own "inside" copy in mutuals-data.ts, not invented ("Books"
 * for Mindful Koi because their about text says "Book and film circles",
 * not because someone guessed readers belong there). Interests without a
 * tribeId are the general pool: universal enough (Food, Coffee, Travel...)
 * that locking them to one Tribe would misrepresent them.
 *
 * This is what lets the interest picker show "Because you're in {Tribe}"
 * first without a second, separate curated list to keep in sync.
 */
export const INTEREST_OPTIONS = [
  { id: "outdoors", label: "Outdoors", tribeId: "wolf" },
  { id: "fitness", label: "Fitness", tribeId: "wolf" },
  { id: "books", label: "Books", tribeId: "koi" },
  { id: "journaling", label: "Journaling", tribeId: "koi" },
  { id: "music", label: "Music", tribeId: "cat" },
  { id: "art", label: "Art & design", tribeId: "cat" },
  { id: "nightlife", label: "Nightlife", tribeId: "owl" },
  { id: "late_night_eats", label: "Late-night eats", tribeId: "owl" },
  { id: "tech", label: "Tech", tribeId: "bee" },
  { id: "business", label: "Business", tribeId: "bee" },
  { id: "food", label: "Food" },
  { id: "coffee", label: "Coffee" },
  { id: "wellness", label: "Wellness" },
  { id: "games", label: "Games" },
  { id: "travel", label: "Travel" },
] as const satisfies ReadonlyArray<{ id: string; label: string; tribeId?: TribeId }>;

/**
 * Deliberately flat / not Tribe-curated - unlike Interests, "Here for"
 * describes what someone wants out of the app, not a taste that clusters by
 * Tribe identity. Tying it to Tribe would presume everyone in a Tribe wants
 * the same thing out of being here, which isn't true even when their
 * hobbies do cluster.
 */
export const SOCIAL_INTENT_OPTIONS = [
  { id: "make_friends", label: "Make friends" },
  { id: "activity_partner", label: "Activity partners" },
  { id: "casual_hangouts", label: "Casual hangouts" },
  { id: "local_exploration", label: "Explore locally" },
  { id: "networking", label: "Professional network" },
  { id: "creative_collab", label: "Creative collaboration" },
  { id: "accountability_partner", label: "Accountability partner" },
  { id: "travel_companion", label: "Travel companion" },
  { id: "mentorship", label: "Mentorship & guidance" },
] as const;

/** Also flat - a schedule fact, not an identity signal. See SOCIAL_INTENT_OPTIONS. */
export const AVAILABILITY_OPTIONS = [
  { id: "weekday_mornings", label: "Weekday mornings" },
  { id: "weekday_afternoons", label: "Weekday afternoons" },
  { id: "weekday_evenings", label: "Weekday evenings" },
  { id: "weekends", label: "Weekends" },
  { id: "spontaneous", label: "Spontaneous plans" },
] as const;

export const GENDER_OPTIONS = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "non_binary", label: "Non-binary" },
] as const;

export const INTEREST_IDS = INTEREST_OPTIONS.map((option) => option.id) as [
  (typeof INTEREST_OPTIONS)[number]["id"],
  ...(typeof INTEREST_OPTIONS)[number]["id"][],
];
export const SOCIAL_INTENT_IDS = SOCIAL_INTENT_OPTIONS.map((option) => option.id) as [
  (typeof SOCIAL_INTENT_OPTIONS)[number]["id"],
  ...(typeof SOCIAL_INTENT_OPTIONS)[number]["id"][],
];
export const AVAILABILITY_IDS = AVAILABILITY_OPTIONS.map((option) => option.id) as [
  (typeof AVAILABILITY_OPTIONS)[number]["id"],
  ...(typeof AVAILABILITY_OPTIONS)[number]["id"][],
];
export const GENDER_IDS = GENDER_OPTIONS.map((option) => option.id) as [
  (typeof GENDER_OPTIONS)[number]["id"],
  ...(typeof GENDER_OPTIONS)[number]["id"][],
];

export type InterestId = (typeof INTEREST_OPTIONS)[number]["id"];
export type SocialIntentId = (typeof SOCIAL_INTENT_OPTIONS)[number]["id"];
export type AvailabilityId = (typeof AVAILABILITY_OPTIONS)[number]["id"];
export type GenderId = (typeof GENDER_OPTIONS)[number]["id"];

/** The interests that reinforce a chosen Tribe - shown first, and where the
 *  "pick at least 2" requirement is enforced from. */
export function primaryInterests(tribeId: TribeId) {
  return INTEREST_OPTIONS.filter((option) => "tribeId" in option && option.tribeId === tribeId);
}

/** Everything else: the general pool plus every other Tribe's flavor -
 *  optional, and exactly where someone whose tastes cross Tribe lines
 *  (a Wolf member who's also into Music) says so. */
export function secondaryInterests(tribeId: TribeId) {
  return INTEREST_OPTIONS.filter((option) => !("tribeId" in option) || option.tribeId !== tribeId);
}

export const INTEREST_MIN_PRIMARY = 2;
export const INTEREST_MAX_TOTAL = 8;

export function optionLabel(options: ReadonlyArray<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

export function toggleSelection<T extends string>(values: T[], value: T, max: number) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  return values.length < max ? [...values, value] : values;
}
