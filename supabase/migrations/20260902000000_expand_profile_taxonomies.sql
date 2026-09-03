-- EXPANDED INTEREST / SOCIAL-INTENT / AVAILABILITY TAXONOMIES.
--
-- Widens the enum lists 20260820001400 hard-coded into these three check
-- constraints, and raises the two caps that grew alongside their pools.
-- Nothing here changes ranking logic (list_explore_matches, this table's own
-- match_score) - a wider enum with the same overlap-scoring shape just gives
-- it more to work with.
--
-- interests: +3 (journaling, late_night_eats, travel), cap unchanged at 8 -
--   the new ids are Tribe-flavored additions (see profile-options.ts), not a
--   reason to let people pick more overall.
-- social_intents: +3 (accountability_partner, travel_companion, mentorship),
--   cap 3 -> 4 to match the larger pool.
-- availability: +1 (weekday_afternoons, filling the one daypart gap), cap
--   4 -> 5 - this field is "select all that apply," so the cap should track
--   the option count exactly.

alter table public.profiles
  drop constraint if exists profiles_interests_allowed,
  add constraint profiles_interests_allowed check (
    cardinality(interests) <= 8 and
    interests <@ array[
      'outdoors','fitness','books','journaling','music','art',
      'nightlife','late_night_eats','tech','business',
      'food','coffee','wellness','games','travel'
    ]::text[]
  );

alter table public.profiles
  drop constraint if exists profiles_social_intents_allowed,
  add constraint profiles_social_intents_allowed check (
    cardinality(social_intents) <= 4 and
    social_intents <@ array[
      'make_friends','activity_partner','casual_hangouts','local_exploration',
      'networking','creative_collab','accountability_partner',
      'travel_companion','mentorship'
    ]::text[]
  );

alter table public.profiles
  drop constraint if exists profiles_availability_allowed,
  add constraint profiles_availability_allowed check (
    cardinality(availability) <= 5 and
    availability <@ array[
      'weekday_mornings','weekday_afternoons','weekday_evenings',
      'weekends','spontaneous'
    ]::text[]
  );
