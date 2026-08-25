const BIG_BOUNDARY_QUERY_URLS = {
  village:
    "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KelDesa_10K/MapServer/0/query",
  district:
    "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_Kecamatan_10K/MapServer/0/query",
  municipality:
    "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KabKota_50K/MapServer/0/query",
} as const;

const INDONESIA_BOUNDS = {
  minLatitude: -11.1,
  maxLatitude: 6.2,
  minLongitude: 94.8,
  maxLongitude: 141.1,
} as const;

interface BigDistrictAttributes {
  WADMKD?: unknown;
  WADMKC?: unknown;
  WADMKK?: unknown;
  WADMPR?: unknown;
  KDCPUM?: unknown;
  KDPKAB?: unknown;
}

interface BigDistrictResponse {
  features?: Array<{ attributes?: BigDistrictAttributes }>;
}

export interface IndonesiaAdministrativeArea {
  village: string | null;
  district: string | null;
  municipality: string;
  province: string;
  code: string | null;
  specificity: "village" | "district" | "municipality";
  label: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function municipalityLabel(value: string): string {
  if (!value) return "";
  const jakarta = value.match(/^Kota\s+Adm(?:inistrasi)?\.?\s+Jakarta\s+(.+)$/i);
  if (jakarta) return `Jakarta ${jakarta[1]}`;
  if (/^(Kota|Kabupaten)\s+/i.test(value)) return value;
  return `Kabupaten ${value}`;
}

function firstAttributes(input: unknown): BigDistrictAttributes | null {
  if (!input || typeof input !== "object") return null;

  const response = input as BigDistrictResponse;
  return response.features?.[0]?.attributes ?? null;
}

function parseAdministrativeArea(
  input: unknown,
  specificity: IndonesiaAdministrativeArea["specificity"],
): IndonesiaAdministrativeArea | null {
  const attributes = firstAttributes(input);
  if (!attributes) return null;

  const village = clean(attributes.WADMKD) || null;
  const district = clean(attributes.WADMKC);
  const municipality = municipalityLabel(clean(attributes.WADMKK));
  const province = clean(attributes.WADMPR);
  const code = clean(attributes.KDCPUM) || clean(attributes.KDPKAB) || null;
  if (!municipality || !province) return null;
  if (specificity !== "municipality" && !district) return null;
  if (specificity === "village" && !village) return null;

  return {
    village,
    district: district || null,
    municipality,
    province,
    code,
    specificity,
    // Village/kelurahan identifies the hierarchy but is never placed on a
    // public social profile. District remains the privacy boundary.
    label: district ? `${district}, ${municipality}` : `${municipality}, ${province}`,
  };
}

export function parseBigVillageResponse(input: unknown): IndonesiaAdministrativeArea | null {
  return parseAdministrativeArea(input, "village");
}

export function parseBigDistrictResponse(input: unknown): IndonesiaAdministrativeArea | null {
  return parseAdministrativeArea(input, "district");
}

export function parseBigMunicipalityResponse(input: unknown): IndonesiaAdministrativeArea | null {
  return parseAdministrativeArea(input, "municipality");
}

export function isInsideIndonesia(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= INDONESIA_BOUNDS.minLatitude &&
    latitude <= INDONESIA_BOUNDS.maxLatitude &&
    longitude >= INDONESIA_BOUNDS.minLongitude &&
    longitude <= INDONESIA_BOUNDS.maxLongitude
  );
}

/**
 * Resolve an approximate coordinate through Indonesia's official BIG district
 * boundary layer. Callers pass the same two-decimal coordinate that MEUTUALS
 * stores, never a precise GPS point or an account identifier.
 */
export async function resolveIndonesiaAdministrativeArea(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<IndonesiaAdministrativeArea | null> {
  if (!isInsideIndonesia(latitude, longitude)) return null;

  const approximateLatitude = Math.round(latitude * 100) / 100;
  const approximateLongitude = Math.round(longitude * 100) / 100;
  const signal = AbortSignal.timeout(5_000);
  const attempts = [
    {
      url: BIG_BOUNDARY_QUERY_URLS.village,
      outFields: "WADMKD,WADMKC,WADMKK,WADMPR,KDCPUM,KDPKAB",
      parse: parseBigVillageResponse,
    },
    {
      url: BIG_BOUNDARY_QUERY_URLS.district,
      outFields: "WADMKC,WADMKK,WADMPR,KDCPUM,KDPKAB",
      parse: parseBigDistrictResponse,
    },
    {
      url: BIG_BOUNDARY_QUERY_URLS.municipality,
      outFields: "WADMKK,WADMPR,KDPKAB",
      parse: parseBigMunicipalityResponse,
    },
  ] as const;

  for (const attempt of attempts) {
    const params = new URLSearchParams({
      f: "json",
      geometry: `${approximateLongitude},${approximateLatitude}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: attempt.outFields,
      returnGeometry: "false",
    });

    try {
      const response = await fetcher(`${attempt.url}?${params}`, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) continue;
      const resolved = attempt.parse(await response.json());
      if (resolved) return resolved;
    } catch {
      // The attempts share one budget. After timeout, later requests abort
      // immediately and the caller uses its offline world-city fallback.
    }
  }

  return null;
}
