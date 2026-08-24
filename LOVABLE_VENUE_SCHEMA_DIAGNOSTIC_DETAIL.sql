-- One-result-set follow-up for Lovable's CSV exporter.
-- Safe to export: returns schema metadata and counts, never venue contents.

select
  (select count(*) from public.venue_places) as venue_places_rows,
  (
    select jsonb_agg(
      jsonb_build_object(
        'table', table_name,
        'position', ordinal_position,
        'column', column_name,
        'type', data_type,
        'nullable', is_nullable,
        'default', column_default
      )
      order by table_name, ordinal_position
    )
    from information_schema.columns
    where table_schema = 'public'
      and table_name in (
        'venue_places',
        'venue_place_coordinates',
        'venture_venues'
      )
  ) as venue_columns,
  (
    select jsonb_agg(
      jsonb_build_object(
        'table', c.relname,
        'constraint', con.conname,
        'definition', pg_get_constraintdef(con.oid)
      )
      order by c.relname, con.conname
    )
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'venue_places',
        'venue_place_coordinates',
        'venture_venues'
      )
  ) as venue_constraints,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ventures'
      and column_name = 'venue_place_id'
  ) as venture_link_exists;
