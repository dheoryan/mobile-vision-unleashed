import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Profile } from "@/components/mutuals/Onboarding";
import type { TribeId } from "@/lib/mutuals-data";
import { getMyProfile, updateMyProfile, type ProfileRow } from "@/lib/profile.functions";
import { useAuth } from "@/lib/auth-context";

const PROFILE_QUERY_KEY = ["my-profile"] as const;

export function rowToProfile(row: ProfileRow | null): Profile | null {
  if (!row) return null;
  if (!row.display_name || !row.tribe_ids?.length) return null; // not yet onboarded
  return {
    tribeIds: row.tribe_ids as TribeId[],
    name: row.display_name,
    handle: row.handle ?? null,
    age: row.age?.toString() ?? "",
    city: row.city ?? "",
    bio: row.bio ?? "",
    avatar: row.avatar_url || row.avatar_emoji || "🌿",
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
  age: number | null;
  city: string;
  bio: string;
  avatar_emoji: string;
  avatar_url: string | null;
  tribe_ids: string[];
  plan: "free" | "plus";
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

/** Build the DB patch from a client-side Profile object. */
export function profileToPatch(p: Profile) {
  const isUrl = !!p.avatar && (p.avatar.startsWith("data:") || p.avatar.startsWith("http"));
  return {
    display_name: p.name,
    age: p.age ? Number(p.age) : null,
    city: p.city,
    bio: p.bio,
    avatar_emoji: isUrl ? "🌿" : p.avatar,
    avatar_url: isUrl ? p.avatar : null,
    tribe_ids: p.tribeIds,
    plan: p.plan,
  };
}
