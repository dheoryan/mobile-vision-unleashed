import assert from "node:assert/strict";
import test from "node:test";
import { searchGooglePlaces, resolveGooglePlace } from "../src/lib/places-api.server.ts";

test("autocomplete keeps the key in headers and sends the session and location bias", async () => {
  const rows = await searchGooglePlaces(
    "test-secret",
    {
      query: "Kopi",
      session_token: "session",
      latitude: -6.3,
      longitude: 106.8,
    },
    async (url, init) => {
      assert.equal(String(url), "https://places.googleapis.com/v1/places:autocomplete");
      assert.equal(new Headers(init?.headers).get("X-Goog-Api-Key"), "test-secret");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.sessionToken, "session");
      assert.deepEqual(body.locationBias.circle.center, { latitude: -6.3, longitude: 106.8 });
      return Response.json({
        suggestions: [
          {
            placePrediction: {
              placeId: "cafe",
              structuredFormat: { mainText: { text: "Cafe" }, secondaryText: { text: "Jakarta" } },
            },
          },
          { queryPrediction: { text: { text: "not a place" } } },
        ],
      });
    },
  );
  assert.deepEqual(rows, [{ place_id: "cafe", primary: "Cafe", secondary: "Jakarta" }]);
});

test("details terminates the same session using Essentials fields only", async () => {
  const place = await resolveGooglePlace(
    "test-secret",
    { place_id: "cafe", session_token: "session" },
    async (url, init) => {
      assert.equal(new URL(String(url)).searchParams.get("sessionToken"), "session");
      assert.equal(
        new Headers(init?.headers).get("X-Goog-FieldMask"),
        "id,location,formattedAddress",
      );
      return Response.json({
        id: "cafe",
        location: { latitude: -6.2, longitude: 106.8 },
        formattedAddress: "Jakarta",
      });
    },
  );
  assert.equal(place.latitude, -6.2);
  assert.equal(place.place_id, "cafe");
});

test("provider errors never disclose raw responses or credentials", async () => {
  await assert.rejects(
    searchGooglePlaces(
      "test-secret",
      { query: "Cafe", session_token: "session" },
      async () => new Response("credential test-secret; internal billing details", { status: 403 }),
    ),
    (error: Error) =>
      error.message.includes("not configured") && !error.message.includes("test-secret"),
  );
});

test("missing key performs no request", async () => {
  let called = false;
  await assert.rejects(
    searchGooglePlaces("", { query: "Cafe", session_token: "session" }, async () => {
      called = true;
      return Response.json({});
    }),
    /not configured/,
  );
  assert.equal(called, false);
});

test("a result without valid coordinates cannot become a selected map pin", async () => {
  await assert.rejects(
    resolveGooglePlace("test-secret", { place_id: "cafe", session_token: "session" }, async () =>
      Response.json({ id: "cafe", location: { latitude: 100, longitude: 106.8 } }),
    ),
    /map pin/,
  );
});

test("quota errors offer manual entry, while empty suggestions remain a valid result", async () => {
  await assert.rejects(
    searchGooglePlaces(
      "test-secret",
      { query: "Cafe", session_token: "session" },
      async () => new Response("quota", { status: 429 }),
    ),
    /Enter the place manually/,
  );
  assert.deepEqual(
    await searchGooglePlaces("test-secret", { query: "Cafe", session_token: "session" }, async () =>
      Response.json({ suggestions: [] }),
    ),
    [],
  );
});
