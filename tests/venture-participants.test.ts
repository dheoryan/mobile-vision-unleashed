import assert from "node:assert/strict";
import test from "node:test";
import type { VentureParty, VentureProfileLite } from "../src/lib/ventures.functions.ts";
import { listVentureParticipants } from "../src/lib/venture-participants.ts";

function profile(id: string, name: string): VentureProfileLite {
  return {
    id,
    display_name: name,
    handle: id,
    avatar_emoji: "",
    avatar_url: null,
    plan: "free",
    city: "",
    bio: "",
    tribe_ids: [],
  };
}

test("Venture directory contains the host and accepted participants only", () => {
  const host = profile("host", "Zara Host");
  const accepted = profile("accepted", "Ari Accepted");
  const pending = profile("pending", "Pia Pending");
  const venture = {
    host,
    applications: [
      { status: "accepted", applicant: accepted },
      { status: "pending", applicant: pending },
      { status: "accepted", applicant: null },
    ],
  } as VentureParty;

  assert.deepEqual(
    listVentureParticipants(venture).map(({ profile: person, role }) => [person.id, role]),
    [
      ["host", "host"],
      ["accepted", "participant"],
    ],
  );
});

test("Venture participants are alphabetical after the host", () => {
  const venture = {
    host: profile("host", "Host"),
    applications: [
      { status: "accepted", applicant: profile("z", "Zed") },
      { status: "accepted", applicant: profile("a", "Ari") },
    ],
  } as VentureParty;

  assert.deepEqual(
    listVentureParticipants(venture).map(({ profile: person }) => person.id),
    ["host", "a", "z"],
  );
});
