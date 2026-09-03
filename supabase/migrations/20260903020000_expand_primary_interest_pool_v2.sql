-- FOURTH EXPANSION PASS on profiles_interests_allowed - the primary
-- (Tribe) tier again, from 10 options per Tribe to 15.
--
-- Same reasoning and same purely-additive shape as the previous three
-- passes: nothing renamed or dropped, so no existing profile's saved
-- interests can go stale. Cap stays 15 total (now expressed in app code as
-- INTEREST_PRIMARY_MAX + INTEREST_SECONDARY_MAX = 5 + 10).

alter table public.profiles
  drop constraint if exists profiles_interests_allowed,
  add constraint profiles_interests_allowed check (
    cardinality(interests) <= 15 and
    interests <@ array[
      'outdoors','fitness','running_training','cycling','recovery_habits',
      'hiking','team_sports','swimming','yoga','martial_arts',
      'rock_climbing','gym_workouts','surfing','badminton','football',
      'books','journaling','film_book_clubs','learning_workshops','collecting',
      'poetry_writing','tabletop_games','museums_exhibits','podcasts','meditation',
      'language_learning','calligraphy','gardening','astronomy','history',
      'music','art','live_shows','crafting_making','photography',
      'theatre_performance','film_video_making','dance','singing','tattoo_body_art',
      'fashion_design','graphic_design','pottery','street_art','animation',
      'nightlife','late_night_eats','karaoke','city_walks','live_music_dj',
      'bar_hopping','street_food','rooftop_hangouts','late_night_drives','clubbing',
      'live_comedy','night_markets','cocktail_making','arcade_games','night_photography',
      'tech','business','startups_networking','side_projects','investing_finance',
      'public_speaking','freelancing','marketing_branding','product_design','career_growth',
      'ai_and_data','ecommerce','consulting','leadership','productivity',
      'food','coffee','cooking','wellness','games','travel','movies_tv',
      'fashion','pets','volunteering'
    ]::text[]
  );
