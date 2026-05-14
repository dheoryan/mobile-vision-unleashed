import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRIBE_IDS = ["wolf", "raven", "fox", "owl", "bear", "stag"] as const;

const updateSchema = z.object({
  display_name: z.string().min(1).max(60).optional(),
  handle: z.string().max(30).nullable().optional(),
  age: z.number().int().min(21).max(120).nullable().optional(),
  city: z.string().max(80).optional(),
  bio: z.string().max(280).optional(),
  avatar_emoji: z.string().max(8).optional(),
  avatar_url: z.string().nullable().optional(),
  tribe_ids: z.array(z.string().min(1).max(40)).max(3).optional(),
  plan: z.enum(["free", "plus"]).optional(),
});

export type ProfileRow = {
  id: string;
  display_name: string;
  handle: string | null;
  age: number | null;
  city: string;
  bio: string;
  avatar_emoji: string;
  avatar_url: string | null;
  tribe_ids: string[];
  plan: "free" | "plus";
  venture_count: number;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, age, city, bio, avatar_emoji, avatar_url, tribe_ids, plan, venture_count")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as ProfileRow | null;
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
      .select("id, display_name, handle, age, city, bio, avatar_emoji, avatar_url, tribe_ids, plan, venture_count")
      .single();
    if (error) throw new Error(error.message);
    return row as ProfileRow;
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
      .select("id, display_name, handle, city, bio, avatar_emoji, avatar_url, tribe_ids, plan")
      .neq("id", userId)
      .limit(120);
    if (data.scope === "mine" && data.tribe_ids && data.tribe_ids.length) {
      q = q.overlaps("tribe_ids", data.tribe_ids);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // RLS already hides blocked rows where I am blocker; double-check by trimming
    // anyone without at least one tribe.
    return ((rows ?? []) as VentureMatch[]).filter((p) => (p.tribe_ids ?? []).length > 0);
  });

export const listDiscoverProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: blockedRows, error: blockedError } = await supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);
    if (blockedError) throw new Error(blockedError.message);

    const blockedIds = new Set((blockedRows ?? []).map((r: { blocked_id: string }) => r.blocked_id));
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, city, bio, avatar_emoji, avatar_url, tribe_ids, plan")
      .neq("id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return ((rows ?? []) as DiscoverProfile[])
      .filter((p) => !blockedIds.has(p.id))
      .filter((p) => (p.tribe_ids ?? []).length > 0);
  });

