-- Ventures get a real clock.
--
-- Until now a Venture's timing was `time_window`: free text, chosen from eight
-- fixed strings ("Tonight", "This weekend", "Flexible"). That is enough to hint
-- at a vibe and not enough to sort by, to expire, or to answer "is this over?".
--
-- `time_window` stays. Nine live Ventures depend on it, four screens render it,
-- and rewriting their timing on their behalf would be inventing data. New
-- Ventures fill in starts_at/ends_at; old ones keep their string and fall back
-- to it at render time.
--
-- What this unlocks beyond display: with ends_at, "past" becomes derivable at
-- read time from a column comparison. That is deliberately NOT a fourth value in
-- ventures_status_check -- adding one means dropping and re-adding a check
-- constraint on a live table, which can fail on existing rows. Deriving it costs
-- nothing and touches nothing.
--
-- Everything here is additive and idempotent: safe to run by hand in the SQL
-- editor now, and a no-op when Lovable applies the same file on its next deploy.

-- ---------- 1. the columns ----------

alter table public.ventures
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz,
  -- IANA zone, not an offset. A meetup at 20:00 is 20:00 where it happens, and
  -- the city list already spans seven regions -- Indonesia alone has three zones.
  -- Captured from the host's browser at create time; this default only covers
  -- rows that predate the column.
  add column if not exists venue_tz  text default 'Asia/Jakarta';

comment on column public.ventures.starts_at is
  'When the Venture begins. Null on Ventures created before this migration, which still carry time_window instead.';
comment on column public.ventures.ends_at is
  'When it finishes. Set from a duration chip rather than a second picker, because hosts do not reliably know their end time. Also what makes "this Venture is over" derivable without a scheduled job.';
comment on column public.ventures.venue_tz is
  'IANA timezone the Venture happens in, e.g. Asia/Jakarta. Rendered in the venue''s zone, not the viewer''s.';

-- ---------- 2. shape constraints ----------
--
-- Note what is NOT here: "starts_at must be in the future". A CHECK constraint
-- must be immutable and now() is not, so Postgres rejects it outright. Past-
-- dating is validated in the create/update server function instead.

do $$
begin
  -- An end without a beginning is meaningless.
  begin
    alter table public.ventures
      add constraint ventures_ends_needs_start
      check (ends_at is null or starts_at is not null);
  exception when duplicate_object then null; end;

  -- Time runs forwards.
  begin
    alter table public.ventures
      add constraint ventures_ends_after_starts
      check (starts_at is null or ends_at is null or ends_at > starts_at);
  exception when duplicate_object then null; end;

  -- A single meetup, not a festival. Catches the fat-finger that sets an end
  -- date a month out, which would otherwise sit on the board forever.
  begin
    alter table public.ventures
      add constraint ventures_duration_sane
      check (starts_at is null or ends_at is null
             or ends_at - starts_at <= interval '24 hours');
  exception when duplicate_object then null; end;
end $$;

-- ---------- 3. the index the new ordering needs ----------
--
-- listOpenVentures currently orders by created_at desc. That is wrong the moment
-- Ventures have start times: something happening this Friday should not sit
-- below one posted ten minutes ago for next month. The partial index matches the
-- query -- open Ventures, soonest first -- and stays small because closed and
-- full ones are excluded.

create index if not exists ventures_open_starts_idx
  on public.ventures (starts_at nulls last, created_at desc)
  where status = 'open';
