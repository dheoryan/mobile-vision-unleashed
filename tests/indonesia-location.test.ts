import assert from "node:assert/strict";
import test from "node:test";
import {
  isInsideIndonesia,
  parseBigDistrictResponse,
  parseBigMunicipalityResponse,
  parseBigVillageResponse,
  resolveIndonesiaAdministrativeArea,
} from "../src/lib/indonesia-location.ts";

function responseFor(district: string, municipality: string, province: string, village?: string) {
  return {
    features: [
      {
        attributes: {
          WADMKD: village,
          WADMKC: district,
          WADMKK: municipality,
          WADMPR: province,
          KDCPUM: "32.16.06",
        },
      },
    ],
  };
}

test("formats Indonesian district, city, and regency labels", () => {
  assert.equal(
    parseBigDistrictResponse(responseFor("Bekasi Barat", "Kota Bekasi", "Jawa Barat"))?.label,
    "Bekasi Barat, Kota Bekasi",
  );
  assert.equal(
    parseBigDistrictResponse(responseFor("Tambun Selatan", "Bekasi", "Jawa Barat"))?.label,
    "Tambun Selatan, Kabupaten Bekasi",
  );
  assert.equal(
    parseBigDistrictResponse(responseFor("Cakung", "Kota Adm. Jakarta Timur", "DKI Jakarta"))
      ?.label,
    "Cakung, Jakarta Timur",
  );
});

test("uses village boundaries without exposing the village on public labels", () => {
  const area = parseBigVillageResponse(
    responseFor("Tambun Selatan", "Bekasi", "Jawa Barat", "Jatimulya"),
  );
  assert.equal(area?.village, "Jatimulya");
  assert.equal(area?.specificity, "village");
  assert.equal(area?.label, "Tambun Selatan, Kabupaten Bekasi");
});

test("falls back to a regency or city label when lower boundaries are missing", () => {
  const area = parseBigMunicipalityResponse(responseFor("", "Kota Jayapura", "Papua"));
  assert.equal(area?.district, null);
  assert.equal(area?.specificity, "municipality");
  assert.equal(area?.label, "Kota Jayapura, Papua");
});

test("limits BIG lookup to Indonesia and rounds coordinates before sending", async () => {
  assert.equal(isInsideIndonesia(-6.2383, 106.9756), true);
  assert.equal(isInsideIndonesia(35.6762, 139.6503), false);

  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify(responseFor("Cikarang Timur", "Bekasi", "Jawa Barat", "Jatibaru")),
    );
  };

  const area = await resolveIndonesiaAdministrativeArea(-6.3074, 107.1721, fetcher);
  assert.equal(area?.label, "Cikarang Timur, Kabupaten Bekasi");
  assert.match(requestedUrl, /geometry=107\.17%2C-6\.31/);
});

test("falls through missing village coverage to the district boundary", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify(
        calls === 1 ? { features: [] } : responseFor("Sirimau", "Kota Ambon", "Maluku"),
      ),
    );
  };

  const area = await resolveIndonesiaAdministrativeArea(-3.6954, 128.1814, fetcher);
  assert.equal(calls, 2);
  assert.equal(area?.specificity, "district");
  assert.equal(area?.label, "Sirimau, Kota Ambon");
});

test("rejects malformed boundary responses", () => {
  assert.equal(parseBigDistrictResponse({ features: [] }), null);
  assert.equal(
    parseBigDistrictResponse({ features: [{ attributes: { WADMKC: "Cakung" } }] }),
    null,
  );
});
