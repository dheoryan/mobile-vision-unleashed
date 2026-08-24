import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GOOGLE_PLACES_ENABLED } from "@/lib/feature-flags";

/**
 * Google Places, proxied.
 *
 * Every call to Google happens here, on the server, with a key that is never in
 * the bundle. The browser sends a search string and gets back suggestions; it
 * never sees `GOOGLE_MAPS_SERVER_KEY`.
 *
 * ---------- the two rules that keep this free ----------
 *
 * 1. A SESSION TOKEN spans the whole picker interaction — every keystroke plus
 *    the one details call that ends it. With a token, autocomplete requests bill
 *    at "Autocomplete Session Usage", which is unlimited and free. Without one
 *    they bill individually at $2.83/1000. The token is the entire difference.
 *
 * 2. The FIELD MASK on the details call asks for `id`, `location` and
 *    `formattedAddress` only. Those are Place Details Essentials — 10,000 free a
 *    month. Adding `displayName` moves the whole call to the Pro SKU at
 *    $17/1000, and `displayName` is a field the terms forbid us to store anyway.
 *
 * ---------- what comes back and what is kept ----------
 *
 * Suggestions are rendered and thrown away — that is display, not caching. Only
 * `place_id` (keepable forever, §A.3) and coordinates (30 days, §14.3) are
 * written to venue_places, alongside a label the host typed themselves.
 */

const SERVER_KEY = () => process.env.GOOGLE_MAPS_SERVER_KEY;

/** Roughly central Jakarta. Biases results without excluding anywhere. */
const DEFAULT_BIAS = { latitude: -6.2, longitude: 106.82, radiusMetres: 40_000 };

export type PlaceSuggestion = {
  place_id: string;
  /** What Google calls it. For display in the picker only — never stored. */
  primary: string;
  /** The address line under it. Also display-only. */
  secondary: string;
};

export type ResolvedPlace = {
  place_id: string;
  latitude: number | null;
  longitude: number | null;
  formatted_address: string;
};

function requireKey(): string {
  if (!GOOGLE_PLACES_ENABLED) {
    throw new Error("Verified map search is not available yet. Enter the venue manually.");
  }

  const key = SERVER_KEY();
  if (!key) {
    // Loud on purpose. The alternative is a picker that silently returns nothing
    // and looks like Jakarta has no cafés in it.
    throw new Error(
      "GOOGLE_MAPS_SERVER_KEY is not set. Add it to .env.local for local development and to Lovable Secrets for production.",
    );
  }
  return key;
}

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().trim().min(2).max(120),
        /** Same token for every keystroke of one search. See rule 1 above. */
        session_token: z.string().uuid(),
        latitude: z.number().finite().min(-90).max(90).optional(),
        longitude: z.number().finite().min(-180).max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const key = requireKey();

    const centre =
      data.latitude != null && data.longitude != null
        ? { latitude: data.latitude, longitude: data.longitude }
        : { latitude: DEFAULT_BIAS.latitude, longitude: DEFAULT_BIAS.longitude };

    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
      },
      body: JSON.stringify({
        input: data.query,
        sessionToken: data.session_token,
        // A bias, not a filter: somewhere just outside the circle still shows up,
        // it just ranks lower. A hard filter would hide the venue two streets
        // past the radius, which is exactly the kind of miss that makes a host
        // stop trusting the picker.
        locationBias: {
          circle: { center: centre, radius: DEFAULT_BIAS.radiusMetres },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Place search failed (${response.status}). ${body.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
          text?: { text?: string };
        };
      }>;
    };

    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .map((p) => ({
        place_id: p.placeId!,
        primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      }))
      .filter((p) => p.primary.length > 0)
      .slice(0, 6);
  });

/**
 * Ends the session and returns the one thing worth keeping: the coordinates.
 *
 * Passing the same `session_token` here is what makes every autocomplete request
 * in the session free. Forget it and they all bill separately — which is the
 * single most expensive mistake available in this file.
 */
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
  .handler(async ({ data }): Promise<ResolvedPlace> => {
    const key = requireKey();

    const url = new URL(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(data.place_id)}`,
    );
    url.searchParams.set("sessionToken", data.session_token);

    const response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": key,
        // Essentials tier only. `displayName` would move this to Pro.
        "X-Goog-FieldMask": "id,location,formattedAddress",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Could not resolve that place (${response.status}). ${body.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      id?: string;
      location?: { latitude?: number; longitude?: number };
      formattedAddress?: string;
    };

    return {
      place_id: json.id ?? data.place_id,
      latitude: json.location?.latitude ?? null,
      longitude: json.location?.longitude ?? null,
      formatted_address: json.formattedAddress ?? "",
    };
  });
