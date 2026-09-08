/** Server-only Google Places transport, behind authenticated server functions. */
export type PlaceSuggestion = { place_id: string; primary: string; secondary: string };
export type ResolvedPlace = {
  place_id: string;
  latitude: number;
  longitude: number;
  formatted_address: string;
};
type SearchInput = { query: string; session_token: string; latitude?: number; longitude?: number };
type DetailsInput = { place_id: string; session_token: string };

async function requestPlaces(
  key: string,
  url: string | URL,
  init: RequestInit,
  fetcher: typeof fetch,
) {
  if (!key.trim())
    throw new Error("Google Maps search is not configured yet. Enter the place manually.");
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      headers: { ...init.headers, "X-Goog-Api-Key": key },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("Google Maps could not be reached. Try again or enter the place manually.");
  }
  // Provider bodies may contain project or credential details. Never forward them.
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Google Maps search is not configured for this app yet. Enter the place manually.",
    );
  }
  if (response.status === 429) {
    throw new Error("Google Maps search is busy. Enter the place manually or try again later.");
  }
  if (!response.ok)
    throw new Error("Google Maps could not find this place. Try again or enter it manually.");
  try {
    return await response.json();
  } catch {
    throw new Error("Google Maps returned an unreadable result. Please try again.");
  }
}

export async function searchGooglePlaces(
  key: string,
  input: SearchInput,
  fetcher: typeof fetch = fetch,
): Promise<PlaceSuggestion[]> {
  const center =
    input.latitude != null && input.longitude != null
      ? { latitude: input.latitude, longitude: input.longitude }
      : { latitude: -6.2, longitude: 106.82 };
  const json = (await requestPlaces(
    key,
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: input.query,
        sessionToken: input.session_token,
        // A bias, not a country restriction. Places outside Jakarta still appear.
        locationBias: { circle: { center, radius: 40_000 } },
      }),
    },
    fetcher,
  )) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        text?: { text?: string };
      };
    }>;
  };
  return (json.suggestions ?? [])
    .flatMap(({ placePrediction: place }) => {
      const primary = place?.structuredFormat?.mainText?.text ?? place?.text?.text ?? "";
      return place?.placeId && primary
        ? [
            {
              place_id: place.placeId,
              primary,
              secondary: place.structuredFormat?.secondaryText?.text ?? "",
            },
          ]
        : [];
    })
    .slice(0, 6);
}

export async function resolveGooglePlace(
  key: string,
  input: DetailsInput,
  fetcher: typeof fetch = fetch,
): Promise<ResolvedPlace> {
  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(input.place_id)}`,
  );
  url.searchParams.set("sessionToken", input.session_token);
  const json = (await requestPlaces(
    key,
    url,
    {
      headers: { "X-Goog-FieldMask": "id,location,formattedAddress" },
    },
    fetcher,
  )) as {
    id?: string;
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
  };
  const latitude = json.location?.latitude;
  const longitude = json.location?.longitude;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error(
      "This place has no usable map pin. Choose another result or enter it manually.",
    );
  }
  return {
    place_id: json.id ?? input.place_id,
    latitude,
    longitude,
    formatted_address: json.formattedAddress ?? "",
  };
}
