import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AVAILABILITY_IDS, INTEREST_IDS, SOCIAL_INTENT_IDS } from "@/lib/profile-options";

const TRIBE_IDS = ["wolf", "koi", "cat", "owl", "bee"] as const;

const updateSchema = z.object({
  display_name: z.string().min(1).max(60).optional(),
  handle: z.string().max(30).nullable().optional(),
  city: z.string().max(80).optional(),
  bio: z.string().max(280).optional(),
  avatar_emoji: z.string().max(8).optional(),
  avatar_url: z.string().nullable().optional(),
  tribe_ids: z.array(z.string().min(1).max(40)).max(3).optional(),
  interests: z.array(z.enum(INTEREST_IDS)).max(8).optional(),
  social_intents: z.array(z.enum(SOCIAL_INTENT_IDS)).max(3).optional(),
  availability: z.array(z.enum(AVAILABILITY_IDS)).max(4).optional(),
  // plan is intentionally NOT user-editable. Plan upgrades must go through a
  // trusted server flow (payment verification) — not the profile update endpoint.
});

export type ProfileRow = {
  id: string;
  display_name: string;
  handle: string | null;
  age: number | null;
  date_of_birth: string | null;
  adult_verified_at: string | null;
  age_verification_locked_at: string | null;
  city: string;
  bio: string;
  avatar_emoji: string;
  avatar_url: string | null;
  tribe_ids: string[];
  interests: string[];
  social_intents: string[];
  availability: string[];
  plan: "free" | "plus";
  venture_count: number;
};

const PROFILE_COLS =
  "id, display_name, handle, city, bio, avatar_emoji, avatar_url, tribe_ids, interests, social_intents, availability, plan, venture_count";
const MY_PROFILE_COLS =
  `${PROFILE_COLS}, age, date_of_birth, adult_verified_at, age_verification_locked_at`;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(MY_PROFILE_COLS)
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as ProfileRow | null;
  });

export const getProfileById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as ProfileRow | null;
  });

export const getProfileByHandle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ handle: z.string().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // handle may be a uuid (from /u/$id usage) or an actual @handle
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.handle);
    let q = supabase.from("profiles").select(PROFILE_COLS);
    q = isUuid ? q.eq("id", data.handle) : q.eq("handle", data.handle.replace(/^@/, ""));
    const { data: row, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    return row as ProfileRow | null;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select(MY_PROFILE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as ProfileRow;
  });

export const verifyMyAge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .update({ date_of_birth: data.date_of_birth })
      .eq("id", userId)
      .select(MY_PROFILE_COLS)
      .single();
    if (error) throw new Error(error.message);
    const profile = row as ProfileRow;
    if (!profile.adult_verified_at) {
      throw new Error("This account does not meet the age requirement.");
    }
    return profile;
  });

export const joinTribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tribe_id: z.enum(TRIBE_IDS) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur, error: e1 } = await supabase
      .from("profiles").select("tribe_ids").eq("id", userId).single();
    if (e1) throw new Error(e1.message);
    const next = Array.from(new Set([...(cur?.tribe_ids ?? []), data.tribe_id]));
    const { data: row, error } = await supabase
      .from("profiles").update({ tribe_ids: next }).eq("id", userId)
      .select("tribe_ids").single();
    if (error) throw new Error(error.message);
    return row.tribe_ids as string[];
  });

export const leaveTribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tribe_id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur, error: e1 } = await supabase
      .from("profiles").select("tribe_ids").eq("id", userId).single();
    if (e1) throw new Error(e1.message);
    const next = (cur?.tribe_ids ?? []).filter((t: string) => t !== data.tribe_id);
    if (next.length === 0) throw new Error("You must belong to at least one tribe");
    const { data: row, error } = await supabase
      .from("profiles").update({ tribe_ids: next }).eq("id", userId)
      .select("tribe_ids").single();
    if (error) throw new Error(error.message);
    return row.tribe_ids as string[];
  });

export type VentureMatch = {
  id: string;
  display_name: string;
  handle: string | null;
  city: string;
  bio: string;
  avatar_emoji: string;
  avatar_url: string | null;
  tribe_ids: string[];
  interests: string[];
  social_intents: string[];
  availability: string[];
  plan: "free" | "plus";
};

export type DiscoverProfile = VentureMatch;

const venturesSchema = z.object({
  scope: z.enum(["mine", "all"]),
  tribe_ids: z.array(z.string().min(1).max(40)).max(10).optional(),
});

export const listVentureMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => venturesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("profiles")
      .select("id, display_name, handle, city, bio, avatar_emoji, avatar_url, tribe_ids, interests, social_intents, availability, plan")
      .neq("id", userId)
      .limit(120);
    if (data.scope === "mine" && data.tribe_ids && data.tribe_ids.length) {
      q = q.overlaps("tribe_ids", data.tribe_ids);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as VentureMatch[]).filter((p) => (p.tribe_ids ?? []).length > 0);
  });

const discoverSchema = z.object({
  search: z.string().max(80).optional(),
  offset: z.number().int().min(0).max(10_000).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type DiscoverPage = {
  rows: DiscoverProfile[];
  nextOffset: number | null;
};

export const listDiscoverProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => discoverSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<DiscoverPage> => {
    const { supabase, userId } = context;
    const limit = data.limit ?? 20;
    const offset = data.offset ?? 0;

    const { data: blockedRows, error: blockedError } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);
    if (blockedError) throw new Error(blockedError.message);
    const blockedIds = new Set((blockedRows ?? []).map((r: { blocked_id: string }) => r.blocked_id));

    let q = supabase
      .from("profiles")
      .select("id, display_name, handle, city, bio, avatar_emoji, avatar_url, tribe_ids, interests, social_intents, availability, plan")
      .neq("id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const term = data.search?.trim();
    if (term) {
      const safe = term.replace(/[,()*]/g, " ").slice(0, 60);
      const like = `%${safe}%`;
      q = q.or(
        `display_name.ilike.${like},handle.ilike.${like},city.ilike.${like},bio.ilike.${like}`,
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const filtered = ((rows ?? []) as DiscoverProfile[])
      .filter((p) => !blockedIds.has(p.id))
      .filter((p) => (p.tribe_ids ?? []).length > 0);

    return {
      rows: filtered,
      nextOffset: (rows?.length ?? 0) === limit ? offset + limit : null,
    };
  });

/** Search profiles by partial @handle / display_name for the @mention picker. */
export const searchMentionProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const safe = data.q.replace(/[,()*%]/g, " ").slice(0, 40);
    const like = `%${safe}%`;
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_emoji, avatar_url")
      .neq("id", userId)
      .or(`display_name.ilike.${like},handle.ilike.${like}`)
      .limit(8);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      display_name: string;
      handle: string | null;
      avatar_emoji: string;
      avatar_url: string | null;
    }>;
  });
