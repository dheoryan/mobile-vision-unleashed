import type { TribeId } from "@/lib/mutuals-data";
import type { GenderId } from "@/lib/profile-options";

/**
 * Illustrated default avatars, one per Tribe x gender, served as static
 * files from `public/default-avatars/` rather than imported through Vite's
 * asset pipeline - these need a stable, origin-qualified URL (one that
 * starts with "http") so the existing `avatar.startsWith("http")`
 * image-vs-emoji check used throughout the app classifies them as a real
 * photo, not literal emoji text to print.
 */
const GENDER_FILE_SUFFIX: Record<GenderId, string> = {
  man: "male",
  woman: "female",
  non_binary: "nonbinary",
};

export function defaultAvatarUrl(
  tribeId: TribeId | null | undefined,
  gender: GenderId | null | undefined,
): string | null {
  if (!tribeId || !gender || typeof window === "undefined") return null;
  return `${window.location.origin}/default-avatars/${tribeId}-${GENDER_FILE_SUFFIX[gender]}.png`;
}
