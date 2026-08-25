const BIG_DISTRICT_QUERY_URL =
  "https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_Kecamatan_10K/MapServer/0/query";

const INDONESIA_BOUNDS = {
  minLatitude: -11.1,
  maxLatitude: 6.2,
  minLongitude: 94.8,
  maxLongitude: 141.1,
} as const;

interface BigDistrictAttributes {
  WADMKC?: unknown;
  WADMKK?: unknown;
  WADMPR?: unknown;
  KDCPUM?: unknown;
}

interface BigDistrictResponse {
  features?: Array<{ attributes?: BigDistrictAttributes }>;
}

export interface IndonesiaAdministrativeArea {
  district: string;
  municipality: string;
  province: string;
  code: string | null;
  label: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function municipalityLabel(value: string): string {
  const jakarta = value.match(/^Kota\s+Adm(?:inistrasi)?\.?\s+Jakarta\s+(.+)$/i);
  if (jakarta) return `Jakarta ${jakarta[1]}`;
  if (/^(Kota|Kabupaten)\s+/i.test(value)) return value;
  return `Kabupaten ${value}`;
}

export function parseBigDistrictResponse(input: unknown): IndonesiaAdministrativeArea | null {
  if (!input || typeof input !== "object") return null;

  const response = input as BigDistrictResponse;
  const attributes = response.features?.[0]?.attributes;
  if (!attributes) return null;

  const district = clean(attributes.WADMKC);
  const municipality = municipalityLabel(clean(attributes.WADMKK));
  const province = clean(attributes.WADMPR);
  const code = clean(attributes.KDCPUM) || null;
  if (!district || !municipality || !province) return null;

  return {
    district,
    municipality,
    province,
    code,
    label: `${district}, ${municipality}`,
  };
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
  const params = new URLSearchParams({
    f: "json",
    geometry: `${approximateLongitude},${approximateLatitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "WADMKC,WADMKK,WADMPR,KDCPUM",
    returnGeometry: "false",
  });

  try {
    const response = await fetcher(`${BIG_DISTRICT_QUERY_URL}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return parseBigDistrictResponse(await response.json());
  } catch {
    return null;
  }
}
