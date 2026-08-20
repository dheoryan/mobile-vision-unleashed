-- Rename the user-facing Tribe label while preserving its stable `koi` key.
update public.tribes
set name = 'Mindful Koi'
where key = 'koi'
  and name is distinct from 'Mindful Koi';
