import type { VentureParty, VentureProfileLite } from "./ventures.functions";

export type VentureParticipant = {
  profile: VentureProfileLite;
  role: "host" | "participant";
};

export function listVentureParticipants(venture: VentureParty): VentureParticipant[] {
  const people = new Map<string, VentureParticipant>();
  if (venture.host) people.set(venture.host.id, { profile: venture.host, role: "host" });

  for (const application of venture.applications) {
    if (application.status === "accepted" && application.applicant) {
      people.set(application.applicant.id, {
        profile: application.applicant,
        role: "participant",
      });
    }
  }

  return Array.from(people.values()).sort((left, right) => {
    if (left.role !== right.role) return left.role === "host" ? -1 : 1;
    const leftName = left.profile.display_name || left.profile.handle || "";
    const rightName = right.profile.display_name || right.profile.handle || "";
    return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
  });
}
