/**
 * Central feature flags.
 *
 * MONETIZATION_ENABLED:
 *   When `false`, all paid/Plus-gated features are unlocked for every user
 *   and Plus-related UI (badges, upgrade CTAs, paywall modals) is hidden.
 *   The "plus" plan code paths are intentionally left in place so we can
 *   re-enable monetization by flipping this single flag back to `true`.
 *
 * GOOGLE_PLACES_ENABLED:
 *   Enabled by user request on 2026-09-08. Requires GOOGLE_MAPS_SERVER_KEY
 *   in the server environment (.env.local locally, Lovable Secrets on deploy).
 *   When false, the picker keeps its manual fallback but Google requests,
 *   badges and maps are disabled.
 */
export const MONETIZATION_ENABLED = false;
export const GOOGLE_PLACES_ENABLED = true;

/** Effective Plus status for the current user. */
export function isPlusEffective(plan: "free" | "plus" | undefined | null): boolean {
  if (!MONETIZATION_ENABLED) return true;
  return plan === "plus";
}

/** Whether to render the Plus badge next to a user. */
export function showPlusBadge(plan: "free" | "plus" | undefined | null): boolean {
  if (!MONETIZATION_ENABLED) return false;
  return plan === "plus";
}
