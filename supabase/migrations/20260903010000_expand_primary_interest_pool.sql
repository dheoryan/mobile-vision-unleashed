-- THIRD EXPANSION PASS on profiles_interests_allowed - the primary (Tribe)
-- tier only, from 5 options per Tribe to 10.
--
-- With the primary tier capped at "choose 3 to 5" and only 5 options on
-- offer, that cap was hollow - 5 available, up to 5 selectable, so there
-- was no real choice inside it. This widens each Tribe's own pool to 10
-- so "3 to 5" is an actual selection, not "take up to all of them."
--
-- Purely additive again, same reasoning as the last two passes: every id
-- already live keeps working, nothing is renamed or dropped, so no
-- existing profile's saved interests can go stale. Cap stays 15 total -
-- this only grows what's available to pick from, not how many.

alter table public.profiles
  drop constraint if exists profiles_interests_allowed,
  add constraint profiles_interests_allowed check (
    cardinality(interests) <= 15 and
    interests <@ array[
      'outdoors','fitness','running_training','cycling','recovery_habits',
      'hiking','team_sports','swimming','yoga','martial_arts',
      'books','journaling','film_book_clubs','learning_workshops','collecting',
      'poetry_writing','tabletop_games','museums_exhibits','podcasts','meditation',
      'music','art','live_shows','crafting_making','photography',
      'theatre_performance','film_video_making','dance','singing','tattoo_body_art',
      'nightlife','late_night_eats','karaoke','city_walks','live_music_dj',
      'bar_hopping','street_food','rooftop_hangouts','late_night_drives','clubbing',
      'tech','business','startups_networking','side_projects','investing_finance',
      'public_speaking','freelancing','marketing_branding','product_design','career_growth',
      'food','coffee','cooking','wellness','games','travel','movies_tv',
      'fashion','pets','volunteering'
    ]::text[]
  );
