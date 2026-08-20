import { INTEREST_OPTIONS, optionLabel } from "@/lib/profile-options";

/**
 * Turning a match into a sentence.
 *
 * A bare "78% match" is not information — the user cannot tell whether it means
 * they like the same books or merely live in the same postcode, so it reads as
 * decoration and gets ignored. The scoring function returns the signals it
 * actually matched on; this turns them into something a person can act on, and
 * the number becomes a summary of stated reasons rather than a claim on its own.
 *
 * Deliberately capped at three chips. A card listing every overlap looks like a
 * search result; a card naming the two or three strongest reads like an
 * introduction.
 */

export type MatchSignals = {
  shared_interests: string[];
  shared_intents: string[];
  shared_availability: string[];
  same_tribe: boolean;
  distance_band: string | null;
  open_venture_title: string | null;
};

/**
 * Phrasings written out rather than derived from the option labels, because
 * the labels are picker text ("Make friends", "Weekday mornings") and generate
 * things like "Both want make friends" when pushed through a template.
 */
const INTENT_PHRASE: Record<string, string> = {
  make_friends: "Both here to make friends",
  activity_partner: "Both want activity partners",
  casual_hangouts: "Both up for casual hangouts",
  local_exploration: "Both exploring the city",
  networking: "Both here to network",
  creative_collab: "Both up for creative work",
};

const AVAILABILITY_PHRASE: Record<string, string> = {
  weekday_mornings: "Both free weekday mornings",
  weekday_evenings: "Both free weekday evenings",
  weekends: "Both free weekends",
  spontaneous: "Both up for spontaneous plans",
};

export type MatchReason = { key: string; label: string; kind: "intent" | "interest" | "time" | "place" | "tribe" };

export function matchReasons(signals: MatchSignals, max = 3): MatchReason[] {
  const reasons: MatchReason[] = [];

  // Ordered by how much each signal actually says about whether these two
  // should meet, which is also the order the scoring function weights them.
  const intent = signals.shared_intents[0];
  if (intent && INTENT_PHRASE[intent]) {
    reasons.push({ key: `intent-${intent}`, label: INTENT_PHRASE[intent], kind: "intent" });
  }

  if (signals.shared_interests.length) {
    const named = signals.shared_interests
      .slice(0, 2)
      .map((id) => optionLabel(INTEREST_OPTIONS, id));
    const extra = signals.shared_interests.length - named.length;
    reasons.push({
      key: "interests",
      label: `Also into ${named.join(" & ")}${extra > 0 ? ` +${extra}` : ""}`,
      kind: "interest",
    });
  }

  const when = signals.shared_availability[0];
  if (when && AVAILABILITY_PHRASE[when]) {
    reasons.push({ key: `time-${when}`, label: AVAILABILITY_PHRASE[when], kind: "time" });
  }

  if (signals.distance_band) {
    reasons.push({ key: "place", label: signals.distance_band, kind: "place" });
  }

  // Last, and only if nothing better exists. Under exclusive membership a
  // tribemate is someone the user can already reach directly, so it is the
  // least useful reason to surface them here.
  if (signals.same_tribe) {
    reasons.push({ key: "tribe", label: "Same Tribe", kind: "tribe" });
  }

  return reasons.slice(0, max);
}

/**
 * A first line the user can send or throw away.
 *
 * The blank Hello box is the drop-off point in this flow: people open it,
 * cannot think of an opener that isn't "hey", and close it. This offers one
 * concrete sentence built from a real overlap. It is a suggestion the user must
 * choose to use — never prefilled, because a Hello that everybody sends
 * identically is worth less than no Hello at all.
 *
 * Returns null when there is no honest hook. A generic opener suggested by the
 * app is worse than the user's own "hey".
 */
export function suggestedOpener(signals: MatchSignals, name: string): string | null {
  const first = name.trim().split(/\s+/)[0] || "there";

  if (signals.open_venture_title) {
    return `Hi ${first} — your "${signals.open_venture_title}" caught my eye. Is there still a spot?`;
  }

  if (signals.shared_interests.length) {
    const label = optionLabel(INTEREST_OPTIONS, signals.shared_interests[0]).toLowerCase();
    return `Hi ${first} — saw we're both into ${label}. What have you been doing with it lately?`;
  }

  const intent = signals.shared_intents[0];
  if (intent === "activity_partner" || intent === "casual_hangouts" || intent === "local_exploration") {
    return `Hi ${first} — looks like we're both after the same kind of thing. Want to plan something?`;
  }

  const when = signals.shared_availability[0];
  if (when && AVAILABILITY_PHRASE[when]) {
    const window = AVAILABILITY_PHRASE[when].replace(/^Both (free|up for) /, "");
    return `Hi ${first} — we're both around ${window}. Up for something?`;
  }

  return null;
}
