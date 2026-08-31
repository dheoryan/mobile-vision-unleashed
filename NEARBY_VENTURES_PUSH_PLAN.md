# Nearby Ventures push notifications — research + plan (NOT IMPLEMENTED)

Written 2026-08-31. Merges the existing Google Places venue-geocoding
research (`HANDOFF.md`, 2026-08-24) with the "Ventures near you" push
notification feature discussed since. **Planning only — no code has been
written for this.** Read `AGENTS.md` first, then `CHANGE_PROTOCOL.md`, then
this file, before touching anything it describes.

---

## Why these two things are one plan, not two

The nearby-notification feature's entire premise — "tell someone when a
Venture goes live near them" — depends on Ventures actually having real
coordinates to measure distance from. Whether that data exists at all is
gated by the Google Places decision below. They have to be planned together
or the notification feature gets designed against data that isn't there.

---

## Part 1 — Google Places venue geocoding (carried over from `HANDOFF.md`)

**Decision already taken, do not re-litigate:** Google Places API, not
OpenStreetMap, for the venue picker's autocomplete. Reasoning and
constraints, verbatim from `HANDOFF.md`:

| Decision | Why |
|---|---|
| Google Places, not OSM | Coverage is what kills a venue picker — a host who gets zero results for a real Kemang bar never trusts it again. |
| Two separate API keys | A referrer restriction is forgeable; fine for the free Embed API, not for billable Places. The server key never enters the browser. |
| Server key has NO application restriction | Cloudflare Workers have no fixed egress IP and send no referrer, so a Websites/IP restriction just rejects every call. Protection is API restriction + quota cap only. |
| Host types both venue name AND area, by hand | Google's terms (§14.3) forbid storing `displayName` or the formatted address. Suggestions are rendered and discarded. What's actually stored forever is the `place_id` (§A.3) — the "verified" green tick keys off `google_place_id` being non-null. |
| Coordinates expire at 30 days | Also §14.3. Not a problem in principle — a Venture happens and is over, and the distance chip only matters beforehand. `expire_venue_coordinates()` does the sweep. |

**Current live status (per `DEVLOG.md`'s Decided table, newer than
`HANDOFF.md`):** `GOOGLE_PLACES_ENABLED = false`. Manual host-authored place
+ area text is the actual production flow right now. Google search, badges,
external maps, embeds, and the server-side Places calls are all gated off
behind that one flag, "pending a team decision on API terms, restrictions,
and quota." Re-enabling is meant to be a single-flag flip once credentials
are approved — not a re-architecture.

**Open items from `HANDOFF.md` that were never resolved (may still be true —
verify before relying on any of them):**
- Quota cap on Places API (New) was never set in Google Cloud console.
- `GOOGLE_MAPS_SERVER_KEY` was in the Lovable secret store but not in local
  `.env.local`, so the picker throws locally.
- The venue search had **never once been seen working** — every prior test
  was an empty result or a 403. Confirming it actually works is step zero
  before anything downstream (including this notification feature) can be
  trusted.

**Direct consequence for this feature:** `venue_place_coordinates` (the
private table holding real lat/lng, joined by `list_venture_distance_bands`)
is very likely near-empty in production today, since the flow that
populates it has been switched off. Before building the nearby-notification
trigger, confirm real coordinate coverage exists — otherwise the feature
would ship against a table with almost nothing in it. A safe first step:
run a count against `venue_place_coordinates` in production, same spirit as
the location-coverage query `HANDOFF.md` already recommends running before
its own step 4.

---

## Part 2 — "Ventures near you": realtime push notification

### The realtime question, answered

No cron is needed. Unlike Tribevia's daily prompt (which had to work around
having no calendar-based trigger in this stack), a Venture going live is a
discrete database event — an `INSERT` into `ventures`, or an `UPDATE` of its
`status` to `'open'`. That's exactly what a Postgres trigger fires on
immediately, same mechanism already powering every other notification in
this app (`notify_on_like`, `notify_on_repost`, `notify_followers_on_post`,
etc.). The moment the row lands, the trigger fires — no polling, no waiting
for a client to open the app and kick off a check.

### The distance math already exists

`list_venture_distance_bands` (`venue_places.sql`) already does the
haversine great-circle calculation between a viewer's rounded
`profile_locations` coordinates and a venture's `venue_place_coordinates`,
and already respects `is_venture_scope_visible`. A fan-out trigger can reuse
this formula directly instead of inventing new geo infrastructure.

### Proposed shape

- **New notification kind**: `venture_nearby`.
- **Trigger**: `AFTER INSERT OR UPDATE OF status ON ventures`, `security
  definer` (same pattern as every other fan-out trigger — must re-validate
  internally since it bypasses RLS), guarded to only fire when the new
  status is `'open'`.
- **Recipients**: everyone with `profile_locations.discoverable = true`,
  within their own already-configured mutual radius of the venue, who could
  also actually *see* the Venture per its existing scope rules
  (`is_venture_scope_visible`) — never anyone the Venture wasn't already
  visible to.
- **Consent framing, not a new tracking surface**: only ever reaches people
  who have already opted into nearby discovery. This is the load-bearing
  constraint — it's what keeps this feature consistent with the app's own
  documented position in `DEVLOG.md` ("no background tracking... distance
  is a bonus, never a gate").
- **New push-preference category**, defaulted **off** (same treatment as
  `new_posts` — the highest-volume, most novel category shouldn't default
  to spamming someone the first time they turn on push).
- **List UI**: not a separate tab. A "Near you" labeled divider at the top
  of the existing Venture board, above the regular chronological list,
  using the same distance-band data/vocabulary already used elsewhere —
  reuse the band strings and chip component from `DiscoverScreen.tsx:586`
  per `HANDOFF.md`'s own instruction not to invent a second vocabulary.

### Known cost, not a blocker

`DEVLOG.md`'s deferred-issues list already flags push fan-out as one Worker
invocation per recipient, no batching (P5). A popular area with an active
Venture would fan out individually to everyone nearby. Fine at this app's
current size; worth knowing before this scales.

---

## Suggested order of operations, when this is picked up

1. Confirm Google Places actually works end to end (the thing that was
   "never once been seen working") and that real coordinates are landing in
   `venue_place_coordinates` at meaningful volume. Everything else is
   pointless to build against empty data.
2. If coordinate coverage is too thin, that's the actual blocker to solve
   first — not the notification trigger.
3. Only then: the `venture_nearby` trigger, the push-preference category,
   and the Venture board's "Near you" section — likely still worth planning
   in `EnterPlanMode` given it touches the DB, a new notification kind, and
   new UI, matching the rigor already applied to the repost/quote-post
   build this session.

**Status: research and design only. Nothing in this document has been
implemented.**
