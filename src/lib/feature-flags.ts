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
 *   When `false`, Venture venues remain fully manual. The Google search UI,
 *   server requests, verified-place badge, and map links are all unavailable.
 *   Re-enable only after the team approves the API terms, key restrictions,
 *   and quota budget.
 */
export const MONETIZATION_ENABLED = false;
export const GOOGLE_PLACES_ENABLED = false;

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
