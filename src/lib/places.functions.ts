import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GOOGLE_PLACES_ENABLED } from "@/lib/feature-flags";
import { searchGooglePlaces, resolveGooglePlace } from "@/lib/places-api.server";

export type { PlaceSuggestion, ResolvedPlace } from "@/lib/places-api.server";

/**
 * Google Places uses a server-only key and a token shared by autocomplete and
 * details. Essentials sessions bill the first 12 autocomplete requests; later
 * requests in that session are free. Details has its own monthly free cap.
 * https://developers.google.com/maps/documentation/places/web-service/session-pricing
 * Suggestions stay transient. Stored venue names and areas are host-authored;
 * place IDs and expiring private coordinates follow the existing venue schema.
 */
function requireKey() {
  if (!GOOGLE_PLACES_ENABLED) {
    throw new Error("Map search is not available yet. Enter the venue manually.");
  }
  return process.env.GOOGLE_MAPS_SERVER_KEY ?? "";
}

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().trim().min(2).max(120),
        session_token: z.string().uuid(),
        latitude: z.number().finite().min(-90).max(90).optional(),
        longitude: z.number().finite().min(-180).max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => searchGooglePlaces(requireKey(), data));

export const resolvePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        place_id: z.string().trim().min(1).max(400),
        session_token: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => resolveGooglePlace(requireKey(), data));
