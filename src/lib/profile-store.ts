import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Profile } from "@/components/mutuals/Onboarding";
import type { TribeId } from "@/lib/mutuals-data";
import {
  getMyProfile,
  getTribeSwitchStatus,
  switchTribe,
  updateMyProfile,
  verifyMyAge,
  type ProfileRow,
} from "@/lib/profile.functions";
import { useAuth } from "@/lib/auth-context";
import type { AvailabilityId, InterestId, SocialIntentId } from "@/lib/profile-options";

const PROFILE_QUERY_KEY = ["my-profile"] as const;

export function rowToProfile(row: ProfileRow | null): Profile | null {
  if (!row) return null;
  if (!row.display_name || !row.tribe_ids?.length) return null; // not yet onboarded
  return {
    tribeIds: row.tribe_ids as TribeId[],
    name: row.display_name,
    handle: row.handle ?? null,
    city: row.city ?? "",
    bio: row.bio ?? "",
    avatar: row.avatar_url || row.avatar_emoji || "🌿",
    interests: (row.interests ?? []) as InterestId[],
    socialIntents: (row.social_intents ?? []) as SocialIntentId[],
    availability: (row.availability ?? []) as AvailabilityId[],
    plan: row.plan,
    ventureCount: row.venture_count ?? 0,
  };
}

export function useProfileRow() {
  const { user, loading } = useAuth();
  const fetchProfile = useServerFn(getMyProfile);
  return useQuery({
    queryKey: [...PROFILE_QUERY_KEY, user?.id ?? null],
    queryFn: () => fetchProfile(),
    enabled: !!user && !loading,
    staleTime: 30_000,
  });
}

export function useMyProfile(): Profile | null {
  const { data } = useProfileRow();
  return rowToProfile(data ?? null);
}

export function useMyAvatar() {
  return useMyProfile()?.avatar ?? "🙂";
}

export function useMyName() {
  return useMyProfile()?.name?.trim() || "You";
}

export type ProfilePatch = Partial<{
  display_name: string;
  handle: string | null;
  city: string;
  bio: string;
  avatar_emoji: string;
  avatar_url: string | null;
  tribe_ids: string[];
  interests: InterestId[];
  social_intents: SocialIntentId[];
  availability: AvailabilityId[];
}>;

export function useUpdateProfile() {
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => update({ data: patch }),
    onSuccess: (row) => {
      qc.setQueryData([...PROFILE_QUERY_KEY, row.id], row);
      qc.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    },
  });
}

const TRIBE_SWITCH_KEY = ["tribe-switch-status"] as const;

/** Whether the user may change Tribe right now, and how long until they can. */
export function useTribeSwitchStatus() {
  const fn = useServerFn(getTribeSwitchStatus);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...TRIBE_SWITCH_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });
}

/**
 * Change Tribe. Membership is exclusive, so this replaces rather than appends.
 * The cooldown is enforced in the database trigger — this hook just surfaces
 * the resulting error and refreshes the affected caches.
 */
export function useSwitchTribe() {
  const fn = useServerFn(switchTribe);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tribeId: TribeId) => fn({ data: { tribe_id: tribeId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      qc.invalidateQueries({ queryKey: TRIBE_SWITCH_KEY });
      // The Tribe feed, member list and chat all change identity.
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["tribes"] });
    },
  });
}

/** Build the DB patch from a client-side Profile object. */
export function profileToPatch(p: Profile) {
  const isUrl = !!p.avatar && (p.avatar.startsWith("data:") || p.avatar.startsWith("http"));
  // NOTE: `plan` is intentionally omitted — it must only be changed by a trusted server flow.
  return {
    display_name: p.name,
    ...(p.handle !== undefined ? { handle: p.handle } : {}),
    city: p.city,
    bio: p.bio,
    avatar_emoji: isUrl ? "🌿" : p.avatar,
    avatar_url: isUrl ? p.avatar : null,
    tribe_ids: p.tribeIds,
    interests: p.interests,
    social_intents: p.socialIntents,
    availability: p.availability,
  };
}

export function useVerifyAge() {
  const verify = useServerFn(verifyMyAge);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dateOfBirth: string) => verify({ data: { date_of_birth: dateOfBirth } }),
    onSuccess: (row) => qc.setQueryData([...PROFILE_QUERY_KEY, row.id], row),
    onSettled: () => qc.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  });
}
