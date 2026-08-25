import assert from "node:assert/strict";
import test from "node:test";
import {
  isInsideIndonesia,
  parseBigDistrictResponse,
  resolveIndonesiaAdministrativeArea,
} from "../src/lib/indonesia-location.ts";

function responseFor(district: string, municipality: string, province: string) {
  return {
    features: [
      {
        attributes: {
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

test("limits BIG lookup to Indonesia and rounds coordinates before sending", async () => {
  assert.equal(isInsideIndonesia(-6.2383, 106.9756), true);
  assert.equal(isInsideIndonesia(35.6762, 139.6503), false);

  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify(responseFor("Cikarang Timur", "Bekasi", "Jawa Barat")));
  };

  const area = await resolveIndonesiaAdministrativeArea(-6.3074, 107.1721, fetcher);
  assert.equal(area?.label, "Cikarang Timur, Kabupaten Bekasi");
  assert.match(requestedUrl, /geometry=107\.17%2C-6\.31/);
});

test("rejects malformed boundary responses", () => {
  assert.equal(parseBigDistrictResponse({ features: [] }), null);
  assert.equal(
    parseBigDistrictResponse({ features: [{ attributes: { WADMKC: "Cakung" } }] }),
    null,
  );
});
