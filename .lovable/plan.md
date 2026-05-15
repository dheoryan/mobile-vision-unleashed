## Goal

Maximize push-notification opt-in for existing users without being abusive: re-show the prompt every session for users who haven't subscribed, while honoring explicit "Skip"/dismiss choices for a cooldown window. Then layer in high-intent triggers (after sending a DM, after publishing a post) where the value of notifications is obvious.

---

## Part 1 — Session-based re-prompt system

### Behavior

- **Subscribed**: never show.
- **Browser permission = denied**: never show (we can't override the browser).
- **iOS Safari, not installed as PWA**: keep the existing "Add to Home Screen" hint, but treat dismiss as session-only (re-shows next session).
- **Permission = default + not subscribed**:
  - On every new session, show a centered modal (stronger than the current banner) shortly after the app loads.
  - User can: **Enable** (triggers permission), **Skip for now** (hides for 3 days), or **Don't ask again** (hides for 30 days but never permanently — we're intentionally persistent).
  - "Skip" closing via X behaves the same as "Skip for now".

### What changes

- New component `PushPromptModal` replacing the inline banner as the primary nudge. Banner stays available for non-blocking contexts (notifications page) but the modal becomes the main driver on app open.
- New util `src/lib/push-prompt-state.ts` with: `shouldShowPrompt()`, `markSkipped(reason: "session" | "soft" | "hard")`, `markEnabled()`. Stores `lastDismissedAt` + `dismissReason` in `localStorage` keyed per user id. Cooldowns: session=this session only, soft=3 days, hard=30 days.
- Session detection: a `sessionStorage` flag `mutuals.push-prompt.shownThisSession` so the modal appears at most once per tab/session even if user navigates.
- Mount the modal once at the root (inside the authenticated layout) so it covers every page after login.

---

## Part 2 — High-intent re-prompts

After a successful action that obviously benefits from push, trigger the modal (overrides the soft cooldown but not the hard 30-day one, and never re-prompts within the same session).

Triggers:
- **After sending a DM** (any DM, not just first — but throttled by the same one-per-session rule). Hook into the message-send success path in `MessagesPanel`.
- **After publishing a post**. Hook into the post-create success path in `ComposerModal`.

Mechanism:
- Add a tiny event bus helper `src/lib/push-prompt-events.ts` exposing `requestPushPrompt(reason: "dm" | "post")`. The mounted `PushPromptModal` subscribes and opens itself if `shouldShowPrompt({ trigger: reason })` returns true.
- Modal copy adapts to trigger: e.g. after DM → "Get notified when they reply." After post → "Get notified when people like or comment."

---

## Files

**New**
- `src/components/mutuals/PushPromptModal.tsx` — modal UI, calls existing `subscribeToPush` + `saveSubscription`.
- `src/lib/push-prompt-state.ts` — cooldown logic + storage.
- `src/lib/push-prompt-events.ts` — small pub/sub for triggering the modal.

**Modified**
- `src/routes/__root.tsx` (or the authenticated layout) — mount `<PushPromptModal />` once.
- `src/components/mutuals/MessagesPanel.tsx` — call `requestPushPrompt("dm")` after a successful send.
- `src/components/mutuals/ComposerModal.tsx` — call `requestPushPrompt("post")` after a successful publish.
- `src/components/mutuals/EnablePushBanner.tsx` — change dismiss to session-only (instead of permanent localStorage flag) so the inline banner on the Notifications page also reappears next session.

No DB changes. No server-fn changes.

---

## Edge cases

- SSR-safe: all storage reads guarded by `typeof window !== "undefined"`.
- iOS Safari (not PWA): modal shows the install instructions instead of an Enable button; high-intent triggers respect the same hard cooldown.
- Logged-out users: modal never mounts.
- After enable success, `markEnabled()` clears all state so modal never shows again on that device.
