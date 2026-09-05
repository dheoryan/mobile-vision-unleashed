# MEUTUALS readability audit

Completed 2026-09-05 against the rules in `DESIGN_RULES_MAP.md`.

## Coverage

- Static review: all 135 TSX files under `src/components` and `src/routes`, plus the shared typography and color tokens in `src/styles.css`.
- Live mobile review at 390 × 844: Timeline, Discover, Ventures, Chats, Profile, Notifications, Settings, post cards, loading states, and the Share post sheet.
- States inspected in code: headings, body copy, metadata, buttons, badges, inputs, placeholders, validation, toasts, loading, empty, error, disabled, selected, modal, drawer, chat, Tribe, Venture, profile, legal, auth, install, and notification states.
- The locked MEUTUALS solid/gradient and all five raw Tribe color tokens were compared before and after the pass and were not changed.

Signed-out onboarding, account recovery, admin moderation, unavailable-content edge states, and monetization-gated routes could not all be opened in the signed-in live session without changing real app state. Their source text and styles were included in the static audit and automated guard.

## Findings and repairs

### High impact

1. **Share totals described unique people instead of completed share actions.** The old `shares` primary key allowed one row per member/post, repeated external shares toggled the row off, and repeated DM/Tribe sends did not increase the total. The new event model records every completed action, keeps request retries idempotent, and commits in-app message shares and their count in one database transaction.
2. **Microtype was used as normal metadata throughout the app.** The audit found 257 explicit text sizes below 12px, including 8.5px and 9.5px Venture labels. These now use the shared 12px compact tier. The Space Mono label system moved from 10px to 12px with slightly tighter tracking so uppercase labels remain readable without becoming dominant.
3. **Raw green and darker Tribe colors were used directly for small text.** The underlying colors remain exact. Text-only accents now mix 68% of the established hue with the existing foreground, giving the same identity at a higher lightness. Backgrounds, borders, art, crests, and selected-state fills still use the original tokens.

### Medium impact

1. **Text over imagery used weak white opacity.** Four overlay styles below 70% were raised to the 70–80% range. Image treatment and layout were left unchanged.
2. **Brand casing varied inside interface copy.** User-facing `Meutuals` labels now use the approved `MEUTUALS` name. Internal lowercase identifiers and domains remain unchanged.
3. **The Tribe chat summary said “1 members.”** It now selects “member” or “members” from the actual count.

### Verified as already sound

- Primary headings and body text retain a clear Inter hierarchy and comfortable line height.
- The bottom navigation remains readable at the narrow viewport without truncating its five destinations.
- Search, caption, composer, auth, and settings inputs preserve the 16px iOS focus safeguard.
- The Share post sheet has a clear heading, grouped targets, optional-caption label, close control, and external-sharing explanation.
- Disabled controls remain visibly disabled; success, warning, and destructive language keeps its semantic role.
- User-generated posts, messages, profiles, and legal promises were not rewritten by the design pass.

## Regression guard

`tests/text-readability.test.ts` scans every component and route for explicit text below 12px, low-opacity white overlay copy, raw dark accent text, and changes to the shared compact-label size. It is available through `npm run check:readability`.

The share behavior also has browser-action tests and a rollback-only PostgreSQL behavior suite covering repeated sends, retry deduplication, multiple members, forged actors/channels, message deletion, account anonymization, and post deletion.
