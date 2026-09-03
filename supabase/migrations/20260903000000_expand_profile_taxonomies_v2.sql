-- SECOND EXPANSION PASS on the same three taxonomies 20260902000000 widened.
--
-- Purely additive - every id already live in production (from
-- 20260902000000 and the original 20260820001400) stays in the allowed
-- list unchanged. This matters because these are CHECK constraints across
-- every existing row: dropping an id that a real profile already has saved
-- would fail the ALTER TABLE outright the moment it tries to validate that
-- row against the new constraint. Only new ids and higher caps are added.
--
-- interests: 15 -> 35 (5 per Tribe now, up from 2, so the primary tier's
--   "choose 3 to 5" has real room; general pool 5 -> 10). Cap 8 -> 15.
-- social_intents: 9 -> 13 (event_companion, language_exchange,
--   volunteer_together, support_advice). Cap 4 -> 5.
-- availability: 5 -> 7 (late_nights, lunch_breaks - new dayparts, not a
--   replacement for the existing ones, so no existing row can go stale).
--   Cap 5 -> 7.

alter table public.profiles
  drop constraint if exists profiles_interests_allowed,
  add constraint profiles_interests_allowed check (
    cardinality(interests) <= 15 and
    interests <@ array[
      'outdoors','fitness','running_training','cycling','recovery_habits',
      'books','journaling','film_book_clubs','learning_workshops','collecting',
      'music','art','live_shows','crafting_making','photography',
      'nightlife','late_night_eats','karaoke','city_walks','live_music_dj',
      'tech','business','startups_networking','side_projects','investing_finance',
      'food','coffee','cooking','wellness','games','travel','movies_tv',
      'fashion','pets','volunteering'
    ]::text[]
  );

alter table public.profiles
  drop constraint if exists profiles_social_intents_allowed,
  add constraint profiles_social_intents_allowed check (
    cardinality(social_intents) <= 5 and
    social_intents <@ array[
      'make_friends','activity_partner','casual_hangouts','local_exploration',
      'networking','creative_collab','accountability_partner',
      'travel_companion','mentorship','event_companion','language_exchange',
      'volunteer_together','support_advice'
    ]::text[]
  );

alter table public.profiles
  drop constraint if exists profiles_availability_allowed,
  add constraint profiles_availability_allowed check (
    cardinality(availability) <= 7 and
    availability <@ array[
      'weekday_mornings','weekday_afternoons','weekday_evenings',
      'weekends','spontaneous','late_nights','lunch_breaks'
    ]::text[]
  );
