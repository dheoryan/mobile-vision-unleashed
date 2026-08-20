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
  time_window: string;
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
  note: string | null;
  max_slots: number | null;
  filled_slots: number | null;
  status: VentureStatus | null;
  created_at: string;
  ended_at: string | null;
  closed_at: string | null;
  image_url: string | null;
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
  "id, user_id, title, intents, scope, time_window, note, max_slots, filled_slots, status, created_at, ended_at, closed_at, image_url";
const APP_COLS = "id, venture_id, applicant_id, status, message, created_at, decided_at";
const MESSAGE_COLS = "id, venture_id, sender_id, content, created_at";

const scopeSchema = z.enum(["mine", "all"]);
const createVentureSchema = z.object({
  title: z.string().trim().min(3).max(80),
  intents: z.array(z.string().trim().min(1).max(40)).min(1).max(5),
  scope: scopeSchema,
  time_window: z.string().trim().min(1).max(80),
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
  const { data, error } = await db
    .from("ventures")
    .select(VENTURE_COLS)
    .eq("id", ventureId)
    .maybeSingle();
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

    const { data: rows, error } = await db
      .from("ventures")
      .select(VENTURE_COLS)
      .eq("status", "open")
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80);
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

    const myApps = await fetchMyApplications(
      db,
      userId,
      visibleRows.map((r) => r.id),
    );
    return visibleRows.map((row) =>
      mapParty(row, hosts.get(row.user_id) ?? null, [], myApps.get(row.id) ?? null),
    );
  });

export const listMyHostedVentures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VentureParty[]> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: rows, error } = await db
      .from("ventures")
      .select(VENTURE_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
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
    const appsByVenture = new Map<string, VentureApplication[]>();
    for (const app of appRows.map((row) => mapApplication(row, applicantMap))) {
      const list = appsByVenture.get(app.venture_id) ?? [];
      list.push(app);
      appsByVenture.set(app.venture_id, list);
    }

    return ventures.map((row) =>
      mapParty(row, hosts.get(row.user_id) ?? null, appsByVenture.get(row.id) ?? [], null),
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
    const { data: ventureRowsRaw, error: ventureError } = await db
      .from("ventures")
      .select(VENTURE_COLS)
      .in("id", ventureIds);
    if (ventureError) throw new Error(ventureError.message);

    const ventureRows = (ventureRowsRaw ?? []) as VentureDbRow[];
    const ventureMap = new Map(ventureRows.map((v) => [v.id, v]));
    const hosts = await fetchProfiles(
      db,
      ventureRows.map((v) => v.user_id),
    );
    const applicants = await fetchProfiles(db, [userId]);

    return appRows
      .map((appRow) => {
        const venture = ventureMap.get(appRow.venture_id);
        if (!venture) return null;
        const app = mapApplication(appRow, applicants);
        return mapParty(venture, hosts.get(venture.user_id) ?? null, [], app);
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

    const { data: ventureRow, error: ventureError } = await db
      .from("ventures")
      .select(VENTURE_COLS)
      .eq("id", app.venture_id)
      .maybeSingle();
    if (ventureError) throw new Error(ventureError.message);
    if (!ventureRow) throw new Error("Venture not found.");
    const venture = ventureRow as VentureDbRow;

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

export const createHostedVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createVentureSchema.parse(input))
  .handler(async ({ data, context }): Promise<VentureParty> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;

    const { data: row, error } = await db
      .from("ventures")
      .insert({
        user_id: userId,
        title: data.title,
        intents: data.intents,
        scope: data.scope,
        time_window: data.time_window,
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

    const hosts = await fetchProfiles(db, [userId]);
    return mapParty(row as VentureDbRow, hosts.get(userId) ?? null);
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

    const { data: venture, error: ventureError } = await db
      .from("ventures")
      .select(VENTURE_COLS)
      .eq("id", data.venture_id)
      .maybeSingle();
    if (ventureError) throw new Error(ventureError.message);
    if (!venture) throw new Error("Venture not found.");
    const row = venture as VentureDbRow;
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
    const { data: ventureRow, error: ventureError } = await db
      .from("ventures")
      .select(VENTURE_COLS)
      .eq("id", app.venture_id)
      .maybeSingle();
    if (ventureError) throw new Error(ventureError.message);
    if (!ventureRow) throw new Error("Venture not found.");

    const venture = ventureRow as VentureDbRow;
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
    createVentureSchema
      .partial()
      .extend({ venture_id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<VentureParty> => {
    const { supabase, userId } = context;
    const db = supabase as unknown as any;
    const { venture_id, ...rest } = data;

    // Only send keys the caller actually supplied. Spreading the whole partial
    // would write `undefined` over untouched columns on some clients.
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    if (!Object.keys(patch).length) {
      throw new Error("Nothing to update.");
    }

    const { data: row, error } = await db
      .from("ventures")
      .update(patch)
      .eq("id", venture_id)
      .eq("user_id", userId)
      .select(VENTURE_COLS)
      .single();
    if (error) throw new Error(error.message);

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
    return mapParty(row as VentureDbRow, people.get(userId) ?? null, applications);
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
