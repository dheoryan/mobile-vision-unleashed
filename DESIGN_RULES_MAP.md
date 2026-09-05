# MEUTUALS design rules and audit boundaries

Prepared 2026-09-05 from the current conversation, AGENTS.md, DEVLOG.md
(including dated corrections), APP_STRUCTURE.md, styles.css, and contextual
color tests. This is a reference map, not a new design specification.
Explicit current user instructions take priority. Newer explicit decisions
supersede older entries. Existing implementation is a baseline, not proof
that a design choice was approved or that it is accessible.

## Locked identity and palette

- Name: **MEUTUALS**. Preserve the logo, established illustrations, and Tribe
  identities. Internal lowercase `mutuals` identifiers remain unchanged.
- User explicitly prohibits changing MEUTUALS main colors or Tribe main colors.
- Preserve these exact live CSS values (comments containing approximate hex
  values are not interchangeable with the actual OKLCH tokens):

| Identity | Token | Current value to preserve |
| --- | --- | --- |
| MEUTUALS solid | `--brand-solid` | `#ff006e` |
| MEUTUALS gradient | `--brand-gradient` | `linear-gradient(100deg, #ff00b8 0%, #ff006e 52%, #ff7a00 100%)` |
| Iron Wolf | `--tribe-wolf` | `oklch(0.6 0.18 35)` |
| Mindful Koi | `--tribe-koi` | `oklch(0.6 0.1 235)` |
| Studio Cat | `--tribe-cat` | `oklch(0.62 0.22 295)` |
| Night Owl | `--tribe-owl` | `oklch(0.78 0.12 80)` |
| Honeybee | `--tribe-bee` | `oklch(0.55 0.07 150)` |

Sources: DEVLOG Decided; src/styles.css; src/lib/mutuals-data.ts; current request.

## Color has a defined purpose

| Area | Preserve |
| --- | --- |
| Everyday app surfaces | Dark Urban Habitat baseline; restrained neutral surfaces and clear foreground hierarchy. Do not turn everything into brand-colored blocks. |
| Brand-level actions | Existing MEUTUALS gradient on primary auth/onboarding, Send Hello, push enablement, and appropriate shared/global entry actions. |
| Audience-dependent actions | The Wild / All Tribes uses the gradient; Tribe-only uses the relevant Tribe color. This applies to Timeline composition and the Venture form, selected choices, Vibe tags, browse scope and sheet confirmations. |
| Identity accents | Use the displayed member/profile/sender's Tribe where the accent represents that person. Do not substitute the viewer's Tribe. |
| Venture chat | Message bubbles follow each sender's Tribe. Own messages are stronger than incoming tints. Preserve the separately approved gradient send action. |
| DM and Tribe composer | Preserve their existing contextual send treatment; the Venture composer alone opts into `gradientAction`. |
| Solid and tinted fills | Use readable foregrounds. Dark text on appropriate solid Tribe fills and normal foreground on tinted selections already exist. White text is not a universal rule for every Tribe fill. Gradient actions currently use white content. Measure before changing text treatment. |
| Social controls | Compact actions have color-only hover/active treatment: Like rose, Repost emerald, Save amber, Delete destructive, other neutral/primary actions contextual. Full menu rows may retain row hover surfaces. |
| Semantic feedback | Warning/destructive colors retain their meaning. Dark toasts use semantic accents rather than unrelated bright full backgrounds. |
| Attention badges | Reserve emphasis for useful activity; Venture History has no count badge and Active hides its count at zero. |

Sources: DEVLOG 2026-09-04 Venture scope rule, 2026-09-05 sender bubbles,
2026-08-31 gradient pass, 2026-08-30 social controls and toasts;
tests/contextual-color-system.test.ts; tests/venture-gradient-system.test.ts.

## Typography, composition and art

- Current type baseline: Inter for body/display; Space Mono for compact labels.
  Improve hierarchy within this system before proposing another typeface.
- Current dark surface layers, rounded controls, glass headers/navigation and
  restrained habitat atmosphere are the baseline to preserve.
- Improve text through size, weight, line height, spacing, line length, wrapping,
  foreground treatment and background separation. The current 9–10px labels
  are an audit target, not an agreed minimum size to preserve.
- Avoid redundant text, icon-only ambiguity, competing emphasis and extra
  decorative containers. Keep action labels specific, such as “Edit profile”.
- Keep transparent WebP illustrations and crests. Faces remain visible under
  raised/half-masks; do not use full face-covering animal masks.
- Artwork backgrounds belong to containers. Preserve opaque backing where
  required for Tribe banners/flip cards without baking rectangles into art.
- No new motion library. Preserve restrained existing CSS transitions and
  approved press/focus feedback; no ornamental animation pass.

The frontend skill's generic suggestions for Framer Motion, hero sections or
new accent colors do not override these app-specific decisions.

## Navigation and interaction

- Preserve the five primary destinations: Timeline, Discover, Ventures, Chats,
  Profile. Keep navigation available while an individual screen loads.
- Profile uses the settings/menu action at the header edge without the bell;
  other primary screens retain Notifications. Discover Search remains local
  to its header rather than becoming global navigation.
- Timeline composition uses its audience-aware FAB. Do not apply an older
  “move every FAB to the header” pass indiscriminately across the app.
- Use AnimatedModal/Radix for modal behavior, focus trapping and dismissals.
  Preserve bottom-sheet/full-screen/right-drawer choices for their jobs.
  Hellos and the Moots picker are right-side drawers with close affordances.
- Maintain consistent secondary back buttons, native-back behavior, mobile
  safe areas, keyboard clearance, touch targets and keyboard focus indication.
- Preserve the iOS 16px input safeguard. Do not shrink focused inputs to make
  layouts fit. Audit actual computed styles, not just Tailwind class names.
- Skeletons match final content geometry; loading, empty, error, disabled and
  pending states must remain distinct and understandable.

## Product language and behaviors that design must respect

- One Tribe per user; switching uses “Move”. Do not restore “Add Tribe”.
- Explore is Today's five, with low-pressure next/later behavior. Search is a
  list. Do not restore match percentages or reject-forever/dating semantics.
- Moots are reciprocal accepted relationships. Sharing lists Moots, including
  people without an existing DM thread, plus the joined Tribe.
- Chat capabilities are shared across DM, Tribe and Venture, with explicit
  exceptions: shared-post targets are DM and Tribe only; completed Venture
  Memories are read-only; group-only mentions are not required in a 1:1 DM.
- Bulk message selection is for own-message Unsend, not a generic bulk toolbar.
- A shared post deleted after the new marker migration displays “This post has
  been deleted.” while retaining the caption. Message unsend is a different
  state. Unavailable content is not automatically described as deleted.
- Preserve Timeline/Signal Thread, Tribevia/Plans, Hello, Moots and Venture
  terminology. Profile activity tabs are Signals / Reposts / Ventures;
  Saved posts live in Settings. Profile stats use Moots / Hosted / Joined.
- Profile facts and interest groups remain distinct. Newer interest decisions
  group Tribe-related interests separately from general interests; do not tint
  every unrelated profile field merely because it belongs to a member.
- Opening Notifications does not mark everything read. Selection marks a row;
  Read all is explicit. Notification destinations retain source context.
- Location is optional, privacy-preserving and mutual. Do not expose exact
  private coordinates or re-enable Google Venue precision through a UI pass.
- Sharing/reposting must preserve the source audience. Do not broaden access.
- Free at launch. Keep monetization gates and accepted pricing copy intact.
- Audience/follow model, host-program strategy and launch geography remain
  product decisions outside a readability audit.

## Conflicts and stale records

- APP_STRUCTURE's Posts/Saved profile map predates Signals/Reposts/Ventures.
- Earlier profile/field colors and Venture edit-only gradient behavior are
  superseded by later field-specific and audience-specific decisions.
- “Minimal CSS fades” does not justify removing later approved CSS press/focus
  feedback, nor does that feedback authorize adding a motion library.
- The Decided table's three reactions, Daily Pulse name and cross-Tribe-only
  Hello wording have later expansions/corrections. Check the dated work log
  and actual flow before treating those old summaries as current requirements.
- Tests can encode stale source shapes or design assumptions. A passing test
  is not proof of contrast/readability, and a regex must not veto a justified
  readability repair that preserves the actual agreed behavior.

## Authorized next audit, in order

1. Shared-post counters: trace in-app DM/Tribe sharing, external sharing,
   cancellation, retries, repeat shares by the same member, multiple members,
   deletion/unsend, server writes, DB triggers and cache refresh. Establish
   whether the displayed number counts people or sends; do not silently
   redefine it. Reproduce failures with isolated data, not real user posts.
2. App-wide text audit: inventory every route, component and overlay; inspect
   headings, body copy, metadata, buttons, badges, inputs, placeholders,
   validation, toasts and all loading/empty/error/disabled/selected states.
3. Cover all five Tribe accents and brand/global contexts; narrow mobile,
   desktop, long content and keyboard/safe-area states. Record code findings
   separately from visually verified findings and unavailable live screens.
4. Produce a severity-ranked component checklist and concrete fixes, preserving
   the locked palette and product rules above. Improving readability does not
   authorize rewriting user-generated content or changing legal promises.

Development can proceed within this scope. Production data is real even from
localhost. Git push requires explicit authorization; production trigger/schema
work follows CHANGE_PROTOCOL. The deleted-post placeholder migration from the
previous task is still pending user-confirmed application and client publication.
