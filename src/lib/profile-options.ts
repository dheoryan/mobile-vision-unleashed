export const INTEREST_OPTIONS = [
  { id: "outdoors", label: "Outdoors" },
  { id: "fitness", label: "Fitness" },
  { id: "books", label: "Books" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art & design" },
  { id: "food", label: "Food" },
  { id: "coffee", label: "Coffee" },
  { id: "nightlife", label: "Nightlife" },
  { id: "tech", label: "Tech" },
  { id: "business", label: "Business" },
  { id: "wellness", label: "Wellness" },
  { id: "games", label: "Games" },
] as const;

export const SOCIAL_INTENT_OPTIONS = [
  { id: "make_friends", label: "Make friends" },
  { id: "activity_partner", label: "Activity partners" },
  { id: "casual_hangouts", label: "Casual hangouts" },
  { id: "local_exploration", label: "Explore locally" },
  { id: "networking", label: "Professional network" },
  { id: "creative_collab", label: "Creative collaboration" },
] as const;

export const AVAILABILITY_OPTIONS = [
  { id: "weekday_mornings", label: "Weekday mornings" },
  { id: "weekday_evenings", label: "Weekday evenings" },
  { id: "weekends", label: "Weekends" },
  { id: "spontaneous", label: "Spontaneous plans" },
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

export type InterestId = (typeof INTEREST_OPTIONS)[number]["id"];
export type SocialIntentId = (typeof SOCIAL_INTENT_OPTIONS)[number]["id"];
export type AvailabilityId = (typeof AVAILABILITY_OPTIONS)[number]["id"];

export function optionLabel(
  options: ReadonlyArray<{ id: string; label: string }>,
  id: string,
) {
  return options.find((option) => option.id === id)?.label ?? id;
}

export function toggleSelection<T extends string>(values: T[], value: T, max: number) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  return values.length < max ? [...values, value] : values;
}

