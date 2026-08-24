/**
 * One place that turns a Venture's timing into words.
 *
 * A Venture can express its timing two ways, and both are legitimate:
 *
 *   - `starts_at` / `ends_at`  — real timestamps, on everything created after
 *     the 20260824012500 migration.
 *   - `time_window`            — free text from a fixed list ("Tonight",
 *     "This weekend", "Flexible"), on everything created before it.
 *
 * Four screens render venture timing — the swipe deck, the chats list, the
 * Ventures deck and a profile's Venture history. Before this file each of them
 * read `time_window` directly, which was fine while there was only one way to
 * say when. With two, four independent fallback chains is four chances to
 * disagree about what a Venture with a null `starts_at` should say. So they all
 * come here instead.
 *
 * Times render in the *venue's* timezone, not the viewer's. A meetup at 20:00 is
 * at 20:00 where it happens; showing a Jakarta evening as 14:00 to someone in
 * London would be technically correct and completely useless. The zone label is
 * only shown when it differs from the viewer's own, because most of the time it
 * doesn't and the noise isn't worth it.
 */

export type VentureTiming = {
  starts_at?: string | null;
  ends_at?: string | null;
  venue_tz?: string | null;
  time_window?: string | null;
};

const FALLBACK_TZ = "Asia/Jakarta";

function viewerTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

/** The zone a Venture happens in. Captured at create time; falls back for old rows. */
export function ventureTz(v: VentureTiming): string {
  return v.venue_tz || FALLBACK_TZ;
}

function parts(iso: string, tz: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** "18:30" in the venue's zone. */
export function clock(iso: string, tz: string): string {
  const p = parts(iso, tz);
  return p ? `${p.hour}:${p.minute}` : "";
}

/** Midnight-to-midnight key in the venue's zone, for grouping a deck by day. */
export function dayKey(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * "Tonight", "Tomorrow", or "Fri 29 Aug" — relative to *today in the venue's
 * zone*, which is the only frame where "tonight" means anything.
 */
export function dayLabel(iso: string, tz: string): string {
  const key = dayKey(iso, tz);
  const today = dayKey(new Date().toISOString(), tz);
  if (key === today) return "Tonight";

  const tomorrow = dayKey(new Date(Date.now() + 86_400_000).toISOString(), tz);
  if (key === tomorrow) return "Tomorrow";

  const p = parts(iso, tz);
  return p ? `${p.weekday} ${p.day} ${p.month}` : "";
}

/**
 * The line a card shows: "Tonight · 18:30–21:30", or the legacy string.
 *
 * Returns null rather than a placeholder when a Venture has neither — the
 * caller renders nothing, because inventing "Any time" would be putting words
 * in a host's mouth.
 */
export function timingLabel(v: VentureTiming): string | null {
  if (!v.starts_at) {
    const legacy = (v.time_window ?? "").trim();
    return legacy.length > 0 ? legacy : null;
  }

  const tz = ventureTz(v);
  const day = dayLabel(v.starts_at, tz);
  const from = clock(v.starts_at, tz);
  const span = v.ends_at ? `${from}–${clock(v.ends_at, tz)}` : from;

  const suffix = tz === viewerTz() ? "" : ` ${zoneAbbr(tz)}`;
  return `${day} · ${span}${suffix}`;
}

/** "WIB", "GMT+7" — short zone name, only used when it differs from the viewer's. */
export function zoneAbbr(tz: string): string {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" });
    return f.formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * Has this Venture finished?
 *
 * Derived, deliberately, rather than stored. Adding a 'past' value to
 * ventures_status_check would mean dropping and re-adding a check constraint on
 * a live table — a Red change under CHANGE_PROTOCOL that can fail on existing
 * rows. A column comparison gets the same answer and touches nothing.
 *
 * A Venture with no end time is never past. That is correct rather than lazy:
 * the nine legacy Ventures say "This weekend", and no honest reading of that
 * tells you when it stopped.
 */
export function isPast(v: VentureTiming, now: Date = new Date()): boolean {
  if (!v.ends_at) return false;
  const end = new Date(v.ends_at).getTime();
  return !Number.isNaN(end) && end < now.getTime();
}

/** How the host picks an end: a duration, not a second clock. */
export const DURATION_CHOICES = [
  { label: "1 hr", minutes: 60 },
  { label: "2 hrs", minutes: 120 },
  { label: "3 hrs", minutes: 180 },
  { label: "All evening", minutes: 300 },
] as const;

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Minutes between start and end, for re-selecting the right chip when editing. */
export function durationMinutes(v: VentureTiming): number | null {
  if (!v.starts_at || !v.ends_at) return null;
  const ms = new Date(v.ends_at).getTime() - new Date(v.starts_at).getTime();
  return Number.isNaN(ms) ? null : Math.round(ms / 60_000);
}

/* ------------------------------------------------------------------------- *
 * Form helpers
 *
 * The host picks a wall-clock day and time. Those are interpreted in the
 * browser's own zone — which is also what we store as `venue_tz`, because a
 * host planning a night out is almost always planning it where they are. That
 * consistency is what lets `new Date("2026-08-24T18:30")`, which parses as
 * local time, produce the correct instant without any manual offset maths.
 * ------------------------------------------------------------------------- */

/** Today as YYYY-MM-DD in the host's own zone — the format a date input wants. */
export function todayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** The two shortcuts worth a chip. Everything else goes through the date input. */
export function dayChoices(): Array<{ value: string; label: string }> {
  return [
    { value: todayKey(0), label: "Tonight" },
    { value: todayKey(1), label: "Tomorrow" },
  ];
}

export function initialDay(v?: VentureTiming | null): string {
  if (!v?.starts_at) return todayKey();
  const d = new Date(v.starts_at);
  return Number.isNaN(d.getTime()) ? todayKey() : toLocalDay(d);
}

export function initialTime(v?: VentureTiming | null): string {
  if (!v?.starts_at) return "19:00";
  const d = new Date(v.starts_at);
  return Number.isNaN(d.getTime()) ? "19:00" : toLocalTime(d);
}

function toLocalDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function toLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function localIso(day: string, time: string): string | null {
  const d = new Date(`${day}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * What the form sends.
 *
 * `time_window` is still populated — it is `not null` on the table, four
 * screens can still read it, and a Venture whose timing exists only as two
 * timestamps would look blank to anything that has not been updated yet. It is
 * derived here rather than asked for twice.
 */
export function timingPayload(day: string, time: string, minutes: number) {
  const starts = localIso(day, time);
  if (!starts) return { time_window: "Flexible" };

  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
    } catch {
      return FALLBACK_TZ;
    }
  })();

  return {
    starts_at: starts,
    ends_at: addMinutes(starts, minutes),
    venue_tz: tz,
    time_window: dayLabel(starts, tz),
  };
}

/** "Ends 21:30 · WIB" — the computed end, shown so a duration chip is legible. */
export function endsAtLabel(day: string, time: string, minutes: number): string {
  const starts = localIso(day, time);
  if (!starts) return "";
  const tz = viewerTz();
  const abbr = zoneAbbr(tz);
  return `Ends ${clock(addMinutes(starts, minutes), tz)}${abbr ? ` · ${abbr}` : ""}`;
}

/** Label a bare YYYY-MM-DD the way the chips do, for the form's summary row. */
export function dayChoiceLabel(day: string): string {
  if (day === todayKey(0)) return "Tonight";
  if (day === todayKey(1)) return "Tomorrow";
  const d = new Date(`${day}T12:00`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}
