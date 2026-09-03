import { type TribeId } from "@/lib/mutuals-data";

/**
 * Every interest that maps to a Tribe carries that Tribe's id - drawn from
 * each Tribe's own "inside" copy in mutuals-data.ts, not invented ("Books"
 * for Mindful Koi because their about text says "Book and film circles",
 * not because someone guessed readers belong there). Interests without a
 * tribeId are the general pool: universal enough (Food, Coffee, Travel...)
 * that locking them to one Tribe would misrepresent them.
 *
 * 15 per Tribe (75 total) so the primary tier - "choose 3 to 5" - is a real
 * choice out of real breadth, not "pick nearly everything we gave you." The
 * picker only shows the first handful at once (see ChoiceGroup's
 * maxVisible) with a "show more" toggle, which is what makes a pool this
 * size workable to actually browse. 10 general options round the full pool
 * out to 85, more than five times the 15-item overall cap.
 */
export const INTEREST_OPTIONS = [
  { id: "outdoors", label: "Outdoors", tribeId: "wolf" },
  { id: "fitness", label: "Fitness", tribeId: "wolf" },
  { id: "running_training", label: "Running & training", tribeId: "wolf" },
  { id: "cycling", label: "Cycling", tribeId: "wolf" },
  { id: "recovery_habits", label: "Recovery & healthy habits", tribeId: "wolf" },
  { id: "hiking", label: "Hiking", tribeId: "wolf" },
  { id: "team_sports", label: "Team sports", tribeId: "wolf" },
  { id: "swimming", label: "Swimming", tribeId: "wolf" },
  { id: "yoga", label: "Yoga", tribeId: "wolf" },
  { id: "martial_arts", label: "Martial arts", tribeId: "wolf" },
  { id: "rock_climbing", label: "Rock climbing", tribeId: "wolf" },
  { id: "gym_workouts", label: "Gym workouts", tribeId: "wolf" },
  { id: "surfing", label: "Surfing", tribeId: "wolf" },
  { id: "badminton", label: "Badminton", tribeId: "wolf" },
  { id: "football", label: "Football", tribeId: "wolf" },
  { id: "books", label: "Books", tribeId: "koi" },
  { id: "journaling", label: "Journaling", tribeId: "koi" },
  { id: "film_book_clubs", label: "Film & book clubs", tribeId: "koi" },
  { id: "learning_workshops", label: "Learning & workshops", tribeId: "koi" },
  { id: "collecting", label: "Collecting", tribeId: "koi" },
  { id: "poetry_writing", label: "Poetry & writing", tribeId: "koi" },
  { id: "tabletop_games", label: "Tabletop games", tribeId: "koi" },
  { id: "museums_exhibits", label: "Museums & exhibits", tribeId: "koi" },
  { id: "podcasts", label: "Podcasts", tribeId: "koi" },
  { id: "meditation", label: "Meditation & mindfulness", tribeId: "koi" },
  { id: "language_learning", label: "Language learning", tribeId: "koi" },
  { id: "calligraphy", label: "Calligraphy", tribeId: "koi" },
  { id: "gardening", label: "Gardening", tribeId: "koi" },
  { id: "astronomy", label: "Astronomy", tribeId: "koi" },
  { id: "history", label: "History", tribeId: "koi" },
  { id: "music", label: "Music", tribeId: "cat" },
  { id: "art", label: "Art & design", tribeId: "cat" },
  { id: "live_shows", label: "Live shows", tribeId: "cat" },
  { id: "crafting_making", label: "Crafting & making", tribeId: "cat" },
  { id: "photography", label: "Photography", tribeId: "cat" },
  { id: "theatre_performance", label: "Theatre & performance", tribeId: "cat" },
  { id: "film_video_making", label: "Film & video making", tribeId: "cat" },
  { id: "dance", label: "Dance", tribeId: "cat" },
  { id: "singing", label: "Singing", tribeId: "cat" },
  { id: "tattoo_body_art", label: "Tattoo & body art", tribeId: "cat" },
  { id: "fashion_design", label: "Fashion design", tribeId: "cat" },
  { id: "graphic_design", label: "Graphic design", tribeId: "cat" },
  { id: "pottery", label: "Pottery", tribeId: "cat" },
  { id: "street_art", label: "Street art", tribeId: "cat" },
  { id: "animation", label: "Animation", tribeId: "cat" },
  { id: "nightlife", label: "Nightlife", tribeId: "owl" },
  { id: "late_night_eats", label: "Late-night eats", tribeId: "owl" },
  { id: "karaoke", label: "Karaoke", tribeId: "owl" },
  { id: "city_walks", label: "City walks & exploring", tribeId: "owl" },
  { id: "live_music_dj", label: "Live music & DJ sets", tribeId: "owl" },
  { id: "bar_hopping", label: "Bar hopping", tribeId: "owl" },
  { id: "street_food", label: "Street food", tribeId: "owl" },
  { id: "rooftop_hangouts", label: "Rooftop hangouts", tribeId: "owl" },
  { id: "late_night_drives", label: "Late-night drives", tribeId: "owl" },
  { id: "clubbing", label: "Clubbing", tribeId: "owl" },
  { id: "live_comedy", label: "Live comedy", tribeId: "owl" },
  { id: "night_markets", label: "Night markets", tribeId: "owl" },
  { id: "cocktail_making", label: "Cocktail making", tribeId: "owl" },
  { id: "arcade_games", label: "Arcade games", tribeId: "owl" },
  { id: "night_photography", label: "Night photography", tribeId: "owl" },
  { id: "tech", label: "Tech", tribeId: "bee" },
  { id: "business", label: "Business", tribeId: "bee" },
  { id: "startups_networking", label: "Startups & networking", tribeId: "bee" },
  { id: "side_projects", label: "Side projects", tribeId: "bee" },
  { id: "investing_finance", label: "Investing & finance", tribeId: "bee" },
  { id: "public_speaking", label: "Public speaking", tribeId: "bee" },
  { id: "freelancing", label: "Freelancing", tribeId: "bee" },
  { id: "marketing_branding", label: "Marketing & branding", tribeId: "bee" },
  { id: "product_design", label: "Product design", tribeId: "bee" },
  { id: "career_growth", label: "Career growth", tribeId: "bee" },
  { id: "ai_and_data", label: "AI & data", tribeId: "bee" },
  { id: "ecommerce", label: "E-commerce", tribeId: "bee" },
  { id: "consulting", label: "Consulting", tribeId: "bee" },
  { id: "leadership", label: "Leadership", tribeId: "bee" },
  { id: "productivity", label: "Productivity", tribeId: "bee" },
  { id: "food", label: "Food" },
  { id: "coffee", label: "Coffee" },
  { id: "cooking", label: "Cooking" },
  { id: "wellness", label: "Wellness" },
  { id: "games", label: "Games" },
  { id: "travel", label: "Travel" },
  { id: "movies_tv", label: "Movies & TV" },
  { id: "fashion", label: "Fashion" },
  { id: "pets", label: "Pets" },
  { id: "volunteering", label: "Volunteering" },
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
  { id: "event_companion", label: "Event companion" },
  { id: "language_exchange", label: "Language exchange" },
  { id: "volunteer_together", label: "Volunteer together" },
  { id: "support_advice", label: "Support & advice" },
] as const;

/** Also flat - a schedule fact, not an identity signal. See SOCIAL_INTENT_OPTIONS. */
export const AVAILABILITY_OPTIONS = [
  { id: "weekday_mornings", label: "Weekday mornings" },
  { id: "weekday_afternoons", label: "Weekday afternoons" },
  { id: "weekday_evenings", label: "Weekday evenings" },
  { id: "weekends", label: "Weekends" },
  { id: "spontaneous", label: "Spontaneous plans" },
  { id: "late_nights", label: "Late nights" },
  { id: "lunch_breaks", label: "Lunch breaks" },
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
 *  "choose 3 to 5" requirement is enforced from. 15 per Tribe. */
export function primaryInterests(tribeId: TribeId) {
  return INTEREST_OPTIONS.filter((option) => "tribeId" in option && option.tribeId === tribeId);
}

/** Everything else: the general pool plus every other Tribe's flavor -
 *  capped independently at INTEREST_SECONDARY_MAX regardless of how many
 *  primary picks were made, and is exactly where someone whose tastes cross
 *  Tribe lines (a Wolf member who's also into Music) says so. */
export function secondaryInterests(tribeId: TribeId) {
  return INTEREST_OPTIONS.filter((option) => !("tribeId" in option) || option.tribeId !== tribeId);
}

export const INTEREST_PRIMARY_MIN = 3;
export const INTEREST_PRIMARY_MAX = 5;
export const INTEREST_SECONDARY_MAX = 10;
export const INTEREST_MAX_TOTAL = INTEREST_PRIMARY_MAX + INTEREST_SECONDARY_MAX;

export function optionLabel(options: ReadonlyArray<{ id: string; label: string }>, id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

export function toggleSelection<T extends string>(values: T[], value: T, max: number) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  return values.length < max ? [...values, value] : values;
}

/**
 * The Interests picker's own toggle: primary caps at INTEREST_PRIMARY_MAX
 * and secondary caps at INTEREST_SECONDARY_MAX, each independently of the
 * other - so "choose 3 to 5" (primary) and "up to 10" (secondary) are both
 * real ceilings, not just suggestions that quietly stop mattering once the
 * other tier has room to spare (picking only 3 primary doesn't buy the
 * secondary tier 2 extra slots beyond its own cap of 10).
 */
export function toggleInterest(
  values: InterestId[],
  value: InterestId,
  tribeId: TribeId,
  isPrimary: boolean,
) {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= INTEREST_MAX_TOTAL) return values;
  const primaryIds = new Set(primaryInterests(tribeId).map((option) => option.id));
  if (isPrimary) {
    const primaryCount = values.filter((item) => primaryIds.has(item)).length;
    if (primaryCount >= INTEREST_PRIMARY_MAX) return values;
  } else {
    const secondaryCount = values.filter((item) => !primaryIds.has(item)).length;
    if (secondaryCount >= INTEREST_SECONDARY_MAX) return values;
  }
  return [...values, value];
}
