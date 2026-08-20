import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const radiusSchema = z.union([z.literal(5), z.literal(15), z.literal(50)]);

export type LocationSettings = {
  discoverable: boolean;
  radius_km: 5 | 15 | 50;
  accuracy_m: number;
  updated_at: string;
};

export type NearbyProfile = {
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
  distance_band: string;
  match_score: number;
};

export const getMyLocationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }): Promise<LocationSettings | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profile_locations")
      .select("discoverable, radius_km, accuracy_m, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as LocationSettings | null;
  });

export const saveMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracy_m: z.number().finite().min(0).max(100_000),
    discoverable: z.boolean().default(true),
    radius_km: radiusSchema.default(15),
  }).parse(input))
  .handler(async ({ data, context }): Promise<LocationSettings> => {
    const { supabase, userId } = context;
    // About 1.1 km at the equator: enough for proximity bands, deliberately
    // too coarse to preserve a home/building-level coordinate.
    const latitude = Math.round(data.latitude * 100) / 100;
    const longitude = Math.round(data.longitude * 100) / 100;
    const { data: row, error } = await supabase
      .from("profile_locations")
      .upsert({
        user_id: userId,
        latitude,
        longitude,
        accuracy_m: Math.round(data.accuracy_m),
        discoverable: data.discoverable,
        radius_km: data.radius_km,
      }, { onConflict: "user_id" })
      .select("discoverable, radius_km, accuracy_m, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as LocationSettings;
  });

export const updateMyLocationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    discoverable: z.boolean(),
    radius_km: radiusSchema,
  }).parse(input))
  .handler(async ({ data, context }): Promise<LocationSettings> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("profile_locations")
      .update(data)
      .eq("user_id", userId)
      .select("discoverable, radius_km, accuracy_m, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as LocationSettings;
  });

export const deleteMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profile_locations").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });

export const listNearbyProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(input ?? {}))
  .handler(async ({ data, context }): Promise<NearbyProfile[]> => {
    const { supabase } = context;
    const { data: matches, error: matchError } = await supabase.rpc("list_nearby_profile_matches", { _limit: data.limit });
    if (matchError) throw new Error(matchError.message);
    if (!matches?.length) return [];

    const ids = matches.map((match) => match.profile_id);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, city, bio, avatar_emoji, avatar_url, tribe_ids, interests, social_intents, availability, plan")
      .in("id", ids);
    if (error) throw new Error(error.message);
    const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return matches.flatMap((match) => {
      const profile = byId.get(match.profile_id);
      return profile ? [{ ...profile, distance_band: match.distance_band, match_score: match.match_score } as NearbyProfile] : [];
    });
  });

