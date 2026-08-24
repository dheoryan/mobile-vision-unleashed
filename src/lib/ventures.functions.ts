/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VentureStatus = "open" | "full" | "closed";
export type VentureScope = "mine" | "all";
export type VentureApplicationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "invited";

export type VentureProfileLite = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string;
  avatar_url: string | null;
  plan: "free" | "plus";
  city: string;
  bio: string;
  tribe_ids: string[];
};

export type VentureApplication = {
  id: string;
  venture_id: string;
  applicant_id: string;
  status: VentureApplicationStatus;
  message: string;
  created_at: string;
  decided_at: string | null;
  applicant: VentureProfileLite | null;
};

export type VentureParty = {
  id: string;
  host_id: string;
  title: string;
  intents: string[];
  scope: VentureScope;
  /** Legacy free-text timing. Kept for Ventures created before 20260824012500. */
  time_window: string;
  /** Real timing. Null on legacy rows, which still carry time_window instead. */
  starts_at: string | null;
  ends_at: string | null;
  /** IANA zone the Venture happens in. Times render here, not in the viewer's zone. */
  venue_tz: string | null;
  /** Where it happens, or null when the host skipped it. */
  venue: VenuePlace | null;
  /** Approximate distance from the current member to the advertised venue. */
  distance_band: string | null;
  /** Accepted-member tier: host-authored arrival instructions. */
  private_venue: VenturePrivateVenue | null;
  note: string;
  max_slots: number;
  filled_slots: number;
  status: VentureStatus;
  created_at: string;
  ended_at: string | null;
  closed_at: string | null;
  /** Object path in the private venture-images bucket, or null. Callers resolve
   *  a signed URL with signVentureImageUrl at render time — never a public URL,
   *  because a scope='mine' Venture is Tribe-only. */
  image_url: string | null;
  host: VentureProfileLite | null;
  my_application: VentureApplication | null;
  applications: VentureApplication[];
  pending_count: number;
  accepted_count: number;
};

export type VentureMessage = {
  id: string;
  venture_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: VentureProfileLite | null;
};

export type VentureInviteRelationship = "following" | "follower" | "mutual";

export type VentureInviteCandidate = VentureProfileLite & {
  relationship: VentureInviteRelationship;
  invite_status: VentureApplicationStatus | null;
};

type VentureDbRow = {
  id: string;
  user_id: string;
  title: string | null;
  intents: string[] | null;
  scope: VentureScope | null;
  time_window: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_tz: string | null;
  venue_place_id: string | null;
  note: string | null;
  max_slots: number | null;
  filled_slots: number | null;
  status: VentureStatus | null;
  created_at: string;
  ended_at: string | null;
  closed_at: string | null;
  image_url: string | null;
};

/**
 * The public tier of a location: what a host advertises, at the coarseness they
 * chose. The exact address and precise pin land in venture_venues at step 5,
 * behind an accepted-members-only policy.
 */
export type VenuePlace = {
  id: string;
  /** The host's own words. Not Google's displayName, which may not be stored. */
  host_label: string;
  area: string;
  /** Non-null is what earns the verified tick. The name proves nothing. */
  google_place_id: string | null;
};

export type VenturePrivateVenue = {
  venture_id: string;
  /** The host's own words, never a cached Google address. */
  arrival_details: string;
  updated_at: string;
};

type VentureApplicationDbRow = {
  id: string;
  venture_id: string;
  applicant_id: string;
  status: VentureApplicationStatus;
  message: string | null;
  created_at: string;
  decided_at: string | null;
};

type VentureMessageDbRow = {
  id: string;
  venture_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

const PROFILE_COLS =
  "id, display_name, handle, avatar_emoji, avatar_url, plan, city, bio, tribe_ids";
const VENTURE_COLS =
  "id, user_id, title, intents, scope, time_window, starts_at, ends_at, venue_tz, venue_place_id, note, max_slots, filled_slots, status, created_at, ended_at, closed_at, image_url";
const LEGACY_VENTURE_COLS =
  "id, user_id, title, intents, scope, time_window, starts_at, ends_at, venue_tz, note, max_slots, filled_slots, status, created_at, ended_at, closed_at, image_url";
const APP_COLS = "id, venture_id, applicant_id, status, message, created_at, decided_at";
const MESSAGE_COLS = "id, venture_id, sender_id, content, created_at";

const scopeSchema = z.enum(["mine", "all"]);
const createVentureSchema = z.object({
  title: z.string().trim().min(3).max(80),
  intents: z.array(z.string().trim().min(1).max(40)).min(1).max(5),
  scope: scopeSchema,
  time_window: z.string().trim().min(1).max(80),
  // Nullable rather than optional: a host clearing a time must be able to say
  // so, and `undefined` means "untouched" to the update patch builder below.
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  venue_tz: z.string().trim().min(1).max(64).nullable().optional(),
  // The venue as the form has it. Turned into a venue_places row by
  // upsertVenue below; the caller never sends a venue_place_id directly,
  // because it does not have one until the row exists.
  venue: z
    .object({
      google_place_id: z.string().trim().max(400).nullable().optional(),
      host_label: z.string().trim().min(1).max(120),
      area: z.string().trim().max(160).optional().default(""),
      latitude: z.number().finite().min(-90).max(90).nullable().optional(),
      longitude: z.number().finite().min(-180).max(180).nullable().optional(),
    })
    .nullable()
    .optional(),
  private_venue: z
    .object({
      arrival_details: z.string().trim().min(1).max(280),
    })
    .nullable()
    .optional(),
  note: z.string().trim().max(280).optional().default(""),
  max_slots: z.number().int().min(2).max(20),
  // A storage object path, not a URL. Shape is enforced again in the database
  // by enforce_venture_image_owner, which is what actually stops a host
  // pointing at somebody else's upload.
  image_url: z
    .string()
    .trim()
    .max(300)
    .regex(/^[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]+$/, "unexpected image path")
    .nullable()
    .optional(),
});

const ventureInviteInputSchema = z.object({
  venture_id: z.string().uuid(),
});

const inviteUserToVentureSchema = z.object({
  venture_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
});

const respondToVentureInviteSchema = z.object({
  application_id: z.string().uuid(),
  status: z.enum(["accepted", "declined"]),
});

/**
 * Venue support ships behind Red migrations. Production must continue serving
 * the pre-venue Venture experience until those migrations are approved, while
 * permission failures and unrelated database errors must still fail loudly.
 */
function isVenueSchemaUnavailable(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  const missingSchemaCodes = new Set([
    "PGRST202",
    "PGRST204",
    "PGRST205",
    "42P01",
    "42703",
    "42883",
  ]);
  const venueIdentifiers = [
    "venue_place_id",
    "venue_places",
    "venue_place_coordinates",
    "venture_venues",
    "list_venture_distance_bands",
  ];
  return missingSchemaCodes.has(code) && venueIdentifiers.some((name) => text.includes(name));
}

async function selectVenturesWithFallback(buildQuery: (columns: string) => any) {
  let result = await buildQuery(VENTURE_COLS);
  if (result.error && isVenueSchemaUnavailable(result.error)) {
    result = await buildQuery(LEGACY_VENTURE_COLS);
  }
  return result;
}

/** Loads the venue rows for a batch of Ventures in one query. */
async function fetchVenues(db: any, ids: Array<string | null>): Promise<Map<string, VenuePlace>> {
  const wanted = uniq(ids);
  if (!wanted.length) return new Map();
  const { data, error } = await db
    .from("venue_places")
    // Coordinates deliberately never leave the database. Discovery receives a
    // band from list_venture_distance_bands instead.
    .select("id, host_label, area, google_place_id")
    .in("id", wanted);
  if (isVenueSchemaUnavailable(error)) return new Map();
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as VenuePlace[]).map((row) => [row.id, row]));
}

async function fetchVentureDistanceBands(
  db: any,
  ventureIds: string[],
): Promise<Map<string, string>> {
  const wanted = uniq(ventureIds).slice(0, 80);
  if (!wanted.length) return new Map();
  const { data, error } = await db.rpc("list_venture_distance_bands", {
    _venture_ids: wanted,
  });
  if (isVenueSchemaUnavailable(error)) return new Map();
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ venture_id: string; distance_band: string }>).map((row) => [
      row.venture_id,
      row.distance_band,
    ]),
  );
}

async function fetchPrivateVenues(
  db: any,
  ventureIds: string[],
): Promise<Map<string, VenturePrivateVenue>> {
  const wanted = uniq(ventureIds);
  if (!wanted.length) return new Map();
  const { data, error } = await db
    .from("venture_venues")
    .select("venture_id, arrival_details, updated_at")
    .in("venture_id", wanted);
  if (isVenueSchemaUnavailable(error)) return new Map();
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as VenturePrivateVenue[]).map((row) => [row.venture_id, row]));
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function hasOverlap(a: string[], b: string[]) {
  if (!a.length || !b.length) return false;
  const s = new Set(a);
  return b.some((id) => s.has(id));
}

function normalizeProfile(row: VentureProfileLite): VentureProfileLite {
  return {
    id: row.id,
    display_name: row.display_name ?? "",
    handle: row.handle ?? null,
    avatar_emoji: row.avatar_emoji ?? "",
    avatar_url: row.avatar_url ?? null,
    plan: row.plan ?? "free",
    city: row.city ?? "",
    bio: row.bio ?? "",
    tribe_ids: Array.isArray(row.tribe_ids) ? row.tribe_ids : [],
  };
}

async function fetchProfiles(db: any, ids: string[]): Promise<Map<string, VentureProfileLite>> {
  const map = new Map<string, VentureProfileLite>();
  const cleanIds = uniq(ids);
  if (!cleanIds.length) return map;

  const { data, error } = await db.from("profiles").select(PROFILE_COLS).in("id", cleanIds);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as VentureProfileLite[]) {
    map.set(row.id, normalizeProfile(row));
  }
  return map;
}

function mapApplication(
  row: VentureApplicationDbRow,
  applicantMap: Map<string, VentureProfileLite>,
): VentureApplication {
  return {
    id: row.id,
    venture_id: row.venture_id,
    applicant_id: row.applicant_id,
    status: row.status,
    message: row.message ?? "",
    created_at: row.created_at,
    decided_at: row.decided_at,
    applicant: applicantMap.get(row.applicant_id) ?? null,
  };
}

function mapParty(
  row: VentureDbRow,
  host: VentureProfileLite | null,
  applications: VentureApplication[] = [],
  myApplication: VentureApplication | null = null,
  venue: VenuePlace | null = null,
  distanceBand: string | null = null,
  privateVenue: VenturePrivateVenue | null = null,
): VentureParty {
  const acceptedCount = applications.filter((a) => a.status === "accepted").length;
  const pendingCount = applications.filter((a) => a.status === "pending").length;
  return {
    id: row.id,
    host_id: row.user_id,
    title: row.title?.trim() || "Open Venture",
    intents: Array.isArray(row.intents) ? row.intents : [],
    scope: row.scope ?? "all",
    time_window: row.time_window ?? "",
    starts_at: row.starts_at ?? null,
    ends_at: row.ends_at ?? null,
    venue_tz: row.venue_tz ?? null,
    venue,
    distance_band: distanceBand,
    private_venue: privateVenue,
    note: row.note ?? "",
    max_slots: row.max_slots ?? 4,
    filled_slots: row.filled_slots ?? Math.min(1 + acceptedCount, row.max_slots ?? 4),
    status: row.status ?? "open",
    created_at: row.created_at,
    ended_at: row.ended_at,
    closed_at: row.closed_at,
    image_url: row.image_url ?? null,
    host,
    my_application: myApplication,
    applications,
    pending_count: pendingCount,
    accepted_count: acceptedCount,
  };
}

async function fetchMyApplications(
  db: any,
  userId: string,
  ventureIds: string[],
): Promise<Map<string, VentureApplication>> {
  const map = new Map<string, VentureApplication>();
  if (!ventureIds.length) return map;

  const { data, error } = await db
    .from("venture_applications")
    .select(APP_COLS)
    .eq("applicant_id", userId)
    .in("venture_id", ventureIds);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as VentureApplicationDbRow[];
  const applicants = await fetchProfiles(
    db,
    rows.map((r) => r.applicant_id),
  );
  for (const row of rows) map.set(row.venture_id, mapApplication(row, applicants));
  return map;
}

async function fetchVentureOrThrow(db: any, ventureId: string): Promise<VentureDbRow> {
  const { data, error } = await selectVenturesWithFallback((columns) =>
    db.from("ventures").select(columns).eq("id", ventureId).maybeSingle(),
  );
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Venture not found.");
  return data as VentureDbRow;
}

async function fetchConnectionIds(db: any, userId: string) {
  const [followingResult, followerResult] = await Promise.all([
    db.from("follows").select("followee_id").eq("follower_id", userId),
    db.from("follows").select("follower_id").eq("followee_id", userId),
  ]);

  if (followingResult.error) throw new Error(followingResult.error.message);
  if (followerResult.error) throw new Error(followerResult.error.message);

  const following = new Set<string>(
    ((followingResult.data ?? []) as Array<{ followee_id: string | null }>)
      .map((row) => row.followee_id)
      .filter(Boolean) as string[],
  );
  const followers = new Set<string>(
    ((followerResult.data ?? []) as Array<{ follower_id: string | null }>)
      .map((row) => row.follower_id)
      .filter(Boolean) as string[],
  );

  return { following, followers, all: uniq([...following, ...followers]) };
}

export const listOpenVentures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ scope: scopeSchema.default("all") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<VentureParty[]> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: me, error: meError } = await db
      .from("profiles")
      .select("tribe_ids")
      .eq("id", userId)
      .maybeSingle();
    if (meError) throw new Error(meError.message);
    const myTribes = Array.isArray(me?.tribe_ids) ? me.tribe_ids : [];

    // Soonest first, not newest first. Once Ventures carry real start times,
    // ordering by created_at buries a meetup happening this Friday under one
    // posted ten minutes ago for next month. Legacy rows have a null starts_at
    // and sort last rather than dropping out — they are still real Ventures,
    // they just cannot say when.
    //
    // Finished Ventures are excluded in the query rather than filtered after,
    // so they do not eat the 80-row limit. A null ends_at is never past: the
    // legacy rows say "This weekend", and no honest reading of that tells you
    // when it stopped.
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await selectVenturesWithFallback((columns) =>
      db
        .from("ventures")
        .select(columns)
        .eq("status", "open")
        .neq("user_id", userId)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("starts_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(80),
    );
    if (error) throw new Error(error.message);

    const allRows = (rows ?? []) as VentureDbRow[];
    const hosts = await fetchProfiles(
      db,
      allRows.map((r) => r.user_id),
    );
    const visibleRows = allRows.filter((row) => {
      const host = hosts.get(row.user_id);
      const overlapsMine = hasOverlap(host?.tribe_ids ?? [], myTribes);
      const ventureAllowsMe = row.scope === "all" || overlapsMine;
      const filterAllows = data.scope === "all" || overlapsMine;
      return ventureAllowsMe && filterAllows;
    });

    const [venues, distanceBands, privateVenues] = await Promise.all([
      fetchVenues(
        db,
        visibleRows.map((r) => r.venue_place_id),
      ),
      fetchVentureDistanceBands(
        db,
        visibleRows.map((r) => r.id),
      ),
      fetchPrivateVenues(
        db,
        visibleRows.map((r) => r.id),
      ),
    ]);
    const myApps = await fetchMyApplications(
      db,
      userId,
      visibleRows.map((r) => r.id),
    );
    return visibleRows.map((row) =>
      mapParty(
        row,
        hosts.get(row.user_id) ?? null,
        [],
        myApps.get(row.id) ?? null,
        venues.get(row.venue_place_id ?? "") ?? null,
        distanceBands.get(row.id) ?? null,
        privateVenues.get(row.id) ?? null,
      ),
    );
  });

export const listMyHostedVentures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VentureParty[]> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: rows, error } = await selectVenturesWithFallback((columns) =>
      db
        .from("ventures")
        .select(columns)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    );
    if (error) throw new Error(error.message);

    const ventures = (rows ?? []) as VentureDbRow[];
    const ids = ventures.map((v) => v.id);
    const [hosts, appResult] = await Promise.all([
      fetchProfiles(db, [userId]),
      ids.length
        ? db
            .from("venture_applications")
            .select(APP_COLS)
            .in("venture_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (appResult.error) throw new Error(appResult.error.message);

    const appRows = (appResult.data ?? []) as VentureApplicationDbRow[];
    const applicantMap = await fetchProfiles(
      db,
      appRows.map((a) => a.applicant_id),
    );
    const [venues, distanceBands, privateVenues] = await Promise.all([
      fetchVenues(
        db,
        ventures.map((v) => v.venue_place_id),
      ),
      fetchVentureDistanceBands(
        db,
        ventures.map((v) => v.id),
      ),
      fetchPrivateVenues(
        db,
        ventures.map((v) => v.id),
      ),
    ]);
    const appsByVenture = new Map<string, VentureApplication[]>();
    for (const app of appRows.map((row) => mapApplication(row, applicantMap))) {
      const list = appsByVenture.get(app.venture_id) ?? [];
      list.push(app);
      appsByVenture.set(app.venture_id, list);
    }

    return ventures.map((row) =>
      mapParty(
        row,
        hosts.get(row.user_id) ?? null,
        appsByVenture.get(row.id) ?? [],
        null,
        venues.get(row.venue_place_id ?? "") ?? null,
        distanceBands.get(row.id) ?? null,
        privateVenues.get(row.id) ?? null,
      ),
    );
  });

export const listMyJoinedVentures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VentureParty[]> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: appRowsRaw, error: appError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .eq("applicant_id", userId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (appError) throw new Error(appError.message);

    const appRows = (appRowsRaw ?? []) as VentureApplicationDbRow[];
    if (!appRows.length) return [];

    const ventureIds = uniq(appRows.map((a) => a.venture_id));
    const { data: ventureRowsRaw, error: ventureError } = await selectVenturesWithFallback(
      (columns) => db.from("ventures").select(columns).in("id", ventureIds),
    );
    if (ventureError) throw new Error(ventureError.message);

    const ventureRows = (ventureRowsRaw ?? []) as VentureDbRow[];
    const ventureMap = new Map(ventureRows.map((v) => [v.id, v]));
    const hosts = await fetchProfiles(
      db,
      ventureRows.map((v) => v.user_id),
    );
    // Who else is in the party.
    //
    // This used to pass a hardcoded [] and it is why an accepted member could
    // see that they were in and nothing about who they were meeting. The host
    // has always had the full applicant list; the people actually turning up to
    // meet strangers had a stub and a chat button.
    //
    // Before the 20260824034000 policy lands this returns only the caller's own
    // row — RLS narrows it — so the UI degrades to a count rather than erroring.
    // After it lands, every accepted member of the same Venture appears. Only
    // 'accepted': declined and pending applicants stay the host's business.
    const { data: partyRowsRaw, error: partyError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .in("venture_id", ventureIds)
      .eq("status", "accepted");
    if (partyError) throw new Error(partyError.message);

    const partyRows = (partyRowsRaw ?? []) as VentureApplicationDbRow[];
    const applicants = await fetchProfiles(db, [
      userId,
      ...partyRows.map((row) => row.applicant_id),
    ]);

    const [venues, distanceBands, privateVenues] = await Promise.all([
      fetchVenues(
        db,
        ventureRows.map((v) => v.venue_place_id),
      ),
      fetchVentureDistanceBands(
        db,
        ventureRows.map((v) => v.id),
      ),
      fetchPrivateVenues(
        db,
        ventureRows.map((v) => v.id),
      ),
    ]);
    const partyByVenture = new Map<string, VentureApplication[]>();
    for (const row of partyRows) {
      const list = partyByVenture.get(row.venture_id) ?? [];
      list.push(mapApplication(row, applicants));
      partyByVenture.set(row.venture_id, list);
    }

    return appRows
      .map((appRow) => {
        const venture = ventureMap.get(appRow.venture_id);
        if (!venture) return null;
        const app = mapApplication(appRow, applicants);
        return mapParty(
          venture,
          hosts.get(venture.user_id) ?? null,
          partyByVenture.get(venture.id) ?? [],
          app,
          venues.get(venture.venue_place_id ?? "") ?? null,
          distanceBands.get(venture.id) ?? null,
          privateVenues.get(venture.id) ?? null,
        );
      })
      .filter(Boolean) as VentureParty[];
  });

export const listVentureInviteCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ventureInviteInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<VentureInviteCandidate[]> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const venture = await fetchVentureOrThrow(db, data.venture_id);
    if (venture.user_id !== userId) throw new Error("Only the host can invite people.");

    const connections = await fetchConnectionIds(db, userId);
    const candidateIds = connections.all.filter((id) => id !== userId);
    if (!candidateIds.length) return [];

    const { data: appRowsRaw, error: appError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .eq("venture_id", data.venture_id)
      .in("applicant_id", candidateIds);
    if (appError) throw new Error(appError.message);

    const existingByApplicant = new Map<string, VentureApplicationStatus>();
    for (const app of (appRowsRaw ?? []) as VentureApplicationDbRow[]) {
      existingByApplicant.set(app.applicant_id, app.status);
    }

    const profiles = await fetchProfiles(db, candidateIds);
    return candidateIds
      .map((id) => {
        const profile = profiles.get(id);
        if (!profile) return null;
        const isFollowing = connections.following.has(id);
        const isFollower = connections.followers.has(id);
        const relationship: VentureInviteRelationship =
          isFollowing && isFollower ? "mutual" : isFollowing ? "following" : "follower";
        return {
          ...profile,
          relationship,
          invite_status: existingByApplicant.get(id) ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const left = (a?.display_name || a?.handle || "").toLowerCase();
        const right = (b?.display_name || b?.handle || "").toLowerCase();
        return left.localeCompare(right);
      }) as VentureInviteCandidate[];
  });

export const inviteUserToVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteUserToVentureSchema.parse(input))
  .handler(async ({ data, context }): Promise<VentureApplication> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    if (data.target_user_id === userId) throw new Error("You are already the host.");

    const venture = await fetchVentureOrThrow(db, data.venture_id);
    if (venture.user_id !== userId) throw new Error("Only the host can invite people.");
    if (venture.status === "closed") throw new Error("This Venture is closed.");
    if (venture.status === "full" || (venture.filled_slots ?? 1) >= (venture.max_slots ?? 4)) {
      throw new Error("This Venture is already full.");
    }

    const connections = await fetchConnectionIds(db, userId);
    const isConnected =
      connections.following.has(data.target_user_id) ||
      connections.followers.has(data.target_user_id);
    if (!isConnected)
      throw new Error("You can only invite people you follow or people who follow you.");

    const { data: existingRaw, error: existingError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .eq("venture_id", data.venture_id)
      .eq("applicant_id", data.target_user_id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const existing = existingRaw as VentureApplicationDbRow | null;
    const applicantMap = await fetchProfiles(db, [data.target_user_id]);

    if (existing?.status === "accepted") return mapApplication(existing, applicantMap);
    if (existing?.status === "pending") throw new Error("This user already requested to join.");
    if (existing?.status === "invited") return mapApplication(existing, applicantMap);

    const write = existing
      ? db
          .from("venture_applications")
          .update({ status: "invited", message: "Invited by host", decided_at: null })
          .eq("id", existing.id)
          .select(APP_COLS)
          .single()
      : db
          .from("venture_applications")
          .insert({
            venture_id: data.venture_id,
            applicant_id: data.target_user_id,
            status: "invited",
            message: "Invited by host",
          })
          .select(APP_COLS)
          .single();

    const { data: saved, error: saveError } = await write;
    if (saveError) throw new Error(saveError.message);

    return mapApplication(saved as VentureApplicationDbRow, applicantMap);
  });

export const respondToVentureInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => respondToVentureInviteSchema.parse(input))
  .handler(async ({ data, context }): Promise<VentureApplication> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;
    const now = new Date().toISOString();

    const { data: appRow, error: appError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .eq("id", data.application_id)
      .maybeSingle();
    if (appError) throw new Error(appError.message);
    if (!appRow) throw new Error("Invite not found.");

    const app = appRow as VentureApplicationDbRow;
    if (app.applicant_id !== userId) throw new Error("Only the invited user can respond.");
    if (app.status !== "invited") {
      const applicantMap = await fetchProfiles(db, [userId]);
      return mapApplication(app, applicantMap);
    }

    const venture = await fetchVentureOrThrow(db, app.venture_id);

    if (data.status === "accepted") {
      if (venture.status === "closed") throw new Error("This Venture is closed.");
      if (venture.status === "full") throw new Error("This Venture is full.");

      const { count, error: countError } = await db
        .from("venture_applications")
        .select("id", { count: "exact", head: true })
        .eq("venture_id", app.venture_id)
        .eq("status", "accepted");
      if (countError) throw new Error(countError.message);

      const filledAfter = 1 + (count ?? 0) + 1;
      if (filledAfter > (venture.max_slots ?? 4)) throw new Error("This Venture is full.");

      const { data: updated, error: updateError } = await db
        .from("venture_applications")
        .update({ status: "accepted", decided_at: now })
        .eq("id", app.id)
        .eq("applicant_id", userId)
        .select(APP_COLS)
        .single();
      if (updateError) throw new Error(updateError.message);

      const applicantMap = await fetchProfiles(db, [userId]);
      return mapApplication(updated as VentureApplicationDbRow, applicantMap);
    }

    const { data: updated, error: updateError } = await db
      .from("venture_applications")
      .update({ status: "declined", decided_at: now })
      .eq("id", app.id)
      .eq("applicant_id", userId)
      .select(APP_COLS)
      .single();
    if (updateError) throw new Error(updateError.message);

    const applicantMap = await fetchProfiles(db, [userId]);
    return mapApplication(updated as VentureApplicationDbRow, applicantMap);
  });

/**
 * Timing rules the database cannot express.
 *
 * The shape rules (end after start, 24-hour cap) exist as CHECK constraints too
 * — this is here so a host gets a sentence instead of a Postgres error string.
 * The "not in the past" rule exists ONLY here: a CHECK must be immutable and
 * now() is not, so Postgres refuses to hold it.
 *
 * `allowPast` is true when editing. A host fixing a typo in the title of a
 * Venture that started an hour ago should not be told their start time is
 * invalid — the rule is about scheduling something new, not about editing
 * something underway.
 */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const PAST_GRACE_MS = 10 * 60 * 1000;

function checkTiming<
  T extends {
    starts_at?: string | null;
    ends_at?: string | null;
    venue_tz?: string | null;
  },
>(data: T, { allowPast }: { allowPast: boolean }): T {
  const { starts_at, ends_at, venue_tz } = data;

  if (venue_tz) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: venue_tz });
    } catch {
      throw new Error(`Unknown timezone: ${venue_tz}`);
    }
  }

  if (ends_at && !starts_at) {
    throw new Error("A Venture needs a start time before it can have an end time.");
  }
  if (!starts_at) return data;

  const start = new Date(starts_at).getTime();
  if (Number.isNaN(start)) throw new Error("That start time is not a real date.");

  if (!allowPast && start < Date.now() - PAST_GRACE_MS) {
    throw new Error("That start time has already passed. Pick a time in the future.");
  }

  if (ends_at) {
    const end = new Date(ends_at).getTime();
    if (Number.isNaN(end)) throw new Error("That end time is not a real date.");
    if (end <= start) throw new Error("A Venture has to end after it starts.");
    if (end - start > MAX_DURATION_MS) {
      throw new Error("A Venture can run for at most 24 hours.");
    }
  }

  return data;
}

/**
 * Turns the form's venue into a venue_places row and returns its id.
 *
 * Each Venture gets its own host-authored row. A Google place id identifies the
 * map destination, but the label and area belong to the host; globally reusing
 * a row would make the first host's wording silently become everybody's.
 *
 * Coordinates are stamped with `coords_fetched_at` because they expire:
 * expire_venue_coordinates() deletes them after 30 days, per Google's terms.
 */
async function upsertVenue(
  db: any,
  venue:
    | {
        google_place_id?: string | null;
        host_label: string;
        area?: string;
        latitude?: number | null;
        longitude?: number | null;
      }
    | null
    | undefined,
): Promise<string | null> {
  if (!venue) return null;

  const hasCoords = venue.latitude != null && venue.longitude != null;
  const { data: row, error } = await db
    .from("venue_places")
    .insert({
      google_place_id: venue.google_place_id ?? null,
      host_label: venue.host_label,
      area: venue.area ?? "",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const venuePlaceId = row.id as string;

  // Coordinates live in a table with no client-readable SELECT policy. The
  // distance RPC can see them; public venue queries cannot.
  if (hasCoords) {
    const { error: coordinateError } = await db.from("venue_place_coordinates").insert({
      venue_place_id: venuePlaceId,
      latitude: venue.latitude,
      longitude: venue.longitude,
      fetched_at: new Date().toISOString(),
    });
    if (coordinateError) throw new Error(coordinateError.message);
  }

  return venuePlaceId;
}

async function upsertPrivateVenue(
  db: any,
  ventureId: string,
  privateVenue: { arrival_details: string } | null | undefined,
): Promise<VenturePrivateVenue | null> {
  if (privateVenue === undefined) return null;
  if (privateVenue === null) {
    const { error } = await db.from("venture_venues").delete().eq("venture_id", ventureId);
    if (error) throw new Error(error.message);
    return null;
  }

  const { data, error } = await db
    .from("venture_venues")
    .upsert(
      {
        venture_id: ventureId,
        arrival_details: privateVenue.arrival_details,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "venture_id" },
    )
    .select("venture_id, arrival_details, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as VenturePrivateVenue;
}

export const createHostedVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    checkTiming(createVentureSchema.parse(input), { allowPast: false }),
  )
  .handler(async ({ data, context }): Promise<VentureParty> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const venuePlaceId = await upsertVenue(db, data.venue);

    const { data: row, error } = await db
      .from("ventures")
      .insert({
        user_id: userId,
        title: data.title,
        intents: data.intents,
        scope: data.scope,
        time_window: data.time_window,
        starts_at: data.starts_at ?? null,
        ends_at: data.ends_at ?? null,
        venue_tz: data.venue_tz ?? null,
        venue_place_id: venuePlaceId,
        note: data.note,
        max_slots: data.max_slots,
        filled_slots: 1,
        status: "open",
        image_url: data.image_url ?? null,
      })
      .select(VENTURE_COLS)
      .single();
    if (error) throw new Error(error.message);

    // venture_count is maintained by the trg_bump_host_venture_count trigger.
    // It used to be incremented here with a SELECT, an addition in JS, and an
    // UPDATE — two concurrent creates both read N and both wrote N + 1, so one
    // Venture was free. Since that counter is the free-tier quota, the lost
    // increment is a paywall bypass. Do not reintroduce it here.

    const privateVenue = await upsertPrivateVenue(db, (row as VentureDbRow).id, data.private_venue);
    const hosts = await fetchProfiles(db, [userId]);
    const venue = venuePlaceId
      ? {
          id: venuePlaceId,
          host_label: data.venue?.host_label ?? "",
          area: data.venue?.area ?? "",
          google_place_id: data.venue?.google_place_id ?? null,
        }
      : null;
    return mapParty(
      row as VentureDbRow,
      hosts.get(userId) ?? null,
      [],
      null,
      venue,
      null,
      privateVenue,
    );
  });

export const applyToVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        venture_id: z.string().uuid(),
        message: z.string().trim().max(180).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<VentureApplication> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const row = await fetchVentureOrThrow(db, data.venture_id);
    if (row.user_id === userId) throw new Error("You are already hosting this Venture.");
    if (row.status !== "open" || (row.filled_slots ?? 1) >= (row.max_slots ?? 4)) {
      throw new Error("This Venture is already full.");
    }

    const { data: existing, error: existingError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .eq("venture_id", data.venture_id)
      .eq("applicant_id", userId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      const applicantMap = await fetchProfiles(db, [userId]);
      return mapApplication(existing as VentureApplicationDbRow, applicantMap);
    }

    const { data: inserted, error } = await db
      .from("venture_applications")
      .insert({
        venture_id: data.venture_id,
        applicant_id: userId,
        status: "pending",
        message: data.message,
      })
      .select(APP_COLS)
      .single();
    if (error) throw new Error(error.message);

    const applicantMap = await fetchProfiles(db, [userId]);
    return mapApplication(inserted as VentureApplicationDbRow, applicantMap);
  });

export const decideVentureApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        application_id: z.string().uuid(),
        status: z.enum(["accepted", "declined"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<VentureApplication> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: appRow, error: appError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .eq("id", data.application_id)
      .maybeSingle();
    if (appError) throw new Error(appError.message);
    if (!appRow) throw new Error("Application not found.");

    const app = appRow as VentureApplicationDbRow;
    const venture = await fetchVentureOrThrow(db, app.venture_id);
    if (venture.user_id !== userId) throw new Error("Only the host can review requests.");

    if (data.status === "accepted") {
      if (venture.status === "closed") throw new Error("This Venture is closed.");
      if (venture.status === "full" && app.status !== "accepted")
        throw new Error("This Venture is full.");

      const { count, error: countError } = await db
        .from("venture_applications")
        .select("id", { count: "exact", head: true })
        .eq("venture_id", app.venture_id)
        .eq("status", "accepted");
      if (countError) throw new Error(countError.message);

      const currentAccepted = count ?? 0;
      const filledAfter = 1 + currentAccepted + (app.status === "accepted" ? 0 : 1);
      if (filledAfter > (venture.max_slots ?? 4)) throw new Error("This Venture is full.");
    }

    const { data: updated, error } = await db
      .from("venture_applications")
      .update({ status: data.status, decided_at: new Date().toISOString() })
      .eq("id", app.id)
      .select(APP_COLS)
      .single();
    if (error) throw new Error(error.message);

    const applicantMap = await fetchProfiles(db, [
      (updated as VentureApplicationDbRow).applicant_id,
    ]);
    return mapApplication(updated as VentureApplicationDbRow, applicantMap);
  });

export const closeHostedVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ venture_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<VentureParty> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;
    const now = new Date().toISOString();

    const { data: row, error } = await db
      .from("ventures")
      .update({ status: "closed", closed_at: now, ended_at: now })
      .eq("id", data.venture_id)
      .eq("user_id", userId)
      .select(VENTURE_COLS)
      .single();
    if (error) throw new Error(error.message);

    const hosts = await fetchProfiles(db, [userId]);
    return mapParty(row as VentureDbRow, hosts.get(userId) ?? null);
  });

/**
 * Edit an open Venture.
 *
 * Only the fields a host should be able to revise. `filled_slots` and the
 * computed 'full' status are deliberately absent — they are derived from
 * accepted applications, and letting them through here would route around the
 * capacity guard on venture_applications. enforce_venture_host_edits rejects
 * them in the database too, so this is defence in depth rather than the only
 * check.
 */
export const updateHostedVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    checkTiming(
      createVentureSchema.partial().extend({ venture_id: z.string().uuid() }).parse(input),
      // Editing, not scheduling: see checkTiming.
      { allowPast: true },
    ),
  )
  .handler(async ({ data, context }): Promise<VentureParty> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;
    const { venture_id, ...rest } = data;

    const current = await fetchVentureOrThrow(db, venture_id);
    if (current.user_id !== userId) throw new Error("Venture not found or you are not its host.");

    // Only send keys the caller actually supplied. Spreading the whole partial
    // would write `undefined` over untouched columns on some clients.
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      // `venue` is the form's shape, not a column. It becomes a venue_places
      // row and lands as venue_place_id instead.
      if (key === "venue" || key === "private_venue") continue;
      if (value !== undefined) patch[key] = value;
    }
    if (rest.venue !== undefined) {
      if (!rest.venue) {
        patch.venue_place_id = null;
      } else {
        const currentVenues = await fetchVenues(db, [current.venue_place_id]);
        const currentVenue = currentVenues.get(current.venue_place_id ?? "");
        const unchanged =
          currentVenue &&
          currentVenue.google_place_id === (rest.venue.google_place_id ?? null) &&
          currentVenue.host_label === rest.venue.host_label &&
          currentVenue.area === (rest.venue.area ?? "");
        patch.venue_place_id = unchanged
          ? current.venue_place_id
          : await upsertVenue(db, rest.venue);
      }
    }
    if (!Object.keys(patch).length && rest.private_venue === undefined) {
      throw new Error("Nothing to update.");
    }

    let row: VentureDbRow = current;
    if (Object.keys(patch).length) {
      const { data: updated, error } = await db
        .from("ventures")
        .update(patch)
        .eq("id", venture_id)
        .eq("user_id", userId)
        .select(VENTURE_COLS)
        .single();
      if (error) throw new Error(error.message);
      row = updated as VentureDbRow;
    }

    if (rest.private_venue !== undefined) {
      await upsertPrivateVenue(db, venture_id, rest.private_venue);
    }

    // Re-read applications so the returned party carries accurate
    // pending/accepted counts; the card renders them straight after saving.
    const { data: appRows, error: appError } = await db
      .from("venture_applications")
      .select(APP_COLS)
      .eq("venture_id", venture_id);
    if (appError) throw new Error(appError.message);

    const applicantIds = ((appRows ?? []) as VentureApplicationDbRow[]).map((a) => a.applicant_id);
    const people = await fetchProfiles(db, [userId, ...applicantIds]);
    const applications = ((appRows ?? []) as VentureApplicationDbRow[]).map((a) =>
      mapApplication(a, people),
    );
    const typedRow = row;
    const [venues, distanceBands, privateVenues] = await Promise.all([
      fetchVenues(db, [typedRow.venue_place_id]),
      fetchVentureDistanceBands(db, [venture_id]),
      fetchPrivateVenues(db, [venture_id]),
    ]);
    return mapParty(
      typedRow,
      people.get(userId) ?? null,
      applications,
      null,
      venues.get(typedRow.venue_place_id ?? "") ?? null,
      distanceBands.get(venture_id) ?? null,
      privateVenues.get(venture_id) ?? null,
    );
  });

/**
 * Withdraw your own request, or leave a Venture you were accepted into.
 *
 * The database has always permitted this — venture_applications_guard_immutable_fields
 * explicitly allows an applicant to move their own row to 'cancelled' — but
 * nothing in the UI ever called it. So you could ask to join a stranger's
 * meetup and then have no way out of it, which for an app that arranges
 * in-person meetings between people who have not met is not a missing
 * convenience, it is a missing safety exit.
 *
 * Leaving after acceptance frees the seat: sync_venture_slots recounts on the
 * status change and the capacity trigger lets the next person in.
 */
export const withdrawVentureApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ application_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ venture_id: string }> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: row, error } = await db
      .from("venture_applications")
      .update({ status: "cancelled", decided_at: new Date().toISOString() })
      .eq("id", data.application_id)
      .eq("applicant_id", userId)
      .select("venture_id")
      .single();
    if (error) throw new Error(error.message);
    return { venture_id: (row as { venture_id: string }).venture_id };
  });

/**
 * Reopen a closed Venture.
 *
 * enforce_venture_host_edits permits closed -> open specifically so a host who
 * closed by mistake is not forced to recreate the plan and lose its party
 * chat. Everything else about a closed Venture stays frozen until it reopens.
 */
export const reopenHostedVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ venture_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<VentureParty> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: row, error } = await db
      .from("ventures")
      .update({ status: "open", closed_at: null, ended_at: null })
      .eq("id", data.venture_id)
      .eq("user_id", userId)
      .select(VENTURE_COLS)
      .single();
    if (error) throw new Error(error.message);

    const hosts = await fetchProfiles(db, [userId]);
    return mapParty(row as VentureDbRow, hosts.get(userId) ?? null);
  });

export const listVentureMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ venture_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<VentureMessage[]> => {
    const { supabase } = context;
    const db = supabase as unknown as any;

    const { data: rows, error } = await db
      .from("venture_messages")
      .select(MESSAGE_COLS)
      .eq("venture_id", data.venture_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const messages = ((rows ?? []) as VentureMessageDbRow[]).reverse();
    const senders = await fetchProfiles(
      db,
      messages.map((m) => m.sender_id),
    );
    return messages.map((m) => ({
      id: m.id,
      venture_id: m.venture_id,
      sender_id: m.sender_id,
      content: m.content,
      created_at: m.created_at,
      sender: senders.get(m.sender_id) ?? null,
    }));
  });

export const sendVentureMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        venture_id: z.string().uuid(),
        content: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<VentureMessage> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: row, error } = await db
      .from("venture_messages")
      .insert({
        venture_id: data.venture_id,
        sender_id: userId,
        content: data.content,
      })
      .select(MESSAGE_COLS)
      .single();
    if (error) throw new Error(error.message);

    const senders = await fetchProfiles(db, [userId]);
    const message = row as VentureMessageDbRow;
    return {
      id: message.id,
      venture_id: message.venture_id,
      sender_id: message.sender_id,
      content: message.content,
      created_at: message.created_at,
      sender: senders.get(userId) ?? null,
    };
  });
