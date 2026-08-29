import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteMyLocation,
  getMyLocationSettings,
  listNearbyProfiles,
  saveMyLocation,
  updateMyLocationSettings,
} from "@/lib/location.functions";
import {
  requestBrowserLocation,
  type BrowserLocation,
  type LocationRadiusKm,
} from "@/lib/location";

const LOCATION_KEY = ["my-location"] as const;

export function useMyLocationSettings() {
  const getSettings = useServerFn(getMyLocationSettings);
  return useQuery({ queryKey: LOCATION_KEY, queryFn: () => getSettings(), staleTime: 60_000 });
}

export function useSaveMyLocation() {
  const save = useServerFn(saveMyLocation);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: BrowserLocation & { radius_km: LocationRadiusKm; discoverable?: boolean },
    ) => save({ data: { ...input, discoverable: input.discoverable ?? true } }),
    onSuccess: ({ city, ...settings }) => {
      queryClient.setQueryData(LOCATION_KEY, settings);
      // The server re-derives profiles.city from the new coordinates, so the
      // cached profile is stale the moment this resolves.
      if (city) queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["nearby-profiles"] }),
  });
}

/**
 * Silently refreshes location once per browser session for someone who has
 * already opted into Nearby discovery at least once - not a new consent
 * path. "Session" here is the same boundary sessionStorage uses (cleared
 * when the tab/window closes, shared across reloads and navigation within
 * it), which is what "triggered by the session" means in practice: once
 * per real app session, not once per component mount, and not on every
 * background token refresh while the tab stays open for hours.
 *
 * Deliberately scoped to people who are already `discoverable`: calling
 * getCurrentPosition() for someone who has never granted geolocation
 * permission pops the browser's own native permission prompt out of
 * nowhere, which is neither silent nor something this should be doing
 * without the explicit "Use my current area" tap that flow already is.
 * Failures (permission revoked since, GPS unavailable, etc.) are swallowed
 * - this is background upkeep, not a user-initiated action, so it has
 * nothing to show an error toast about.
 */
export function useAutoRefreshLocationOnSession(userId: string | undefined) {
  const settingsQuery = useMyLocationSettings();
  const saveLocation = useSaveMyLocation();
  const ranForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || settingsQuery.isLoading) return;
    const settings = settingsQuery.data;
    if (!settings?.discoverable) return;

    const sessionKey = `meutuals:location-auto-refresh:${userId}`;
    if (ranForUser.current === userId || sessionStorage.getItem(sessionKey)) return;
    ranForUser.current = userId;
    sessionStorage.setItem(sessionKey, "1");

    requestBrowserLocation()
      .then((position) =>
        saveLocation.mutateAsync({
          ...position,
          radius_km: settings.radius_km,
          discoverable: true,
        }),
      )
      .catch(() => {
        // Silent by design - see the doc comment above.
      });
    // saveLocation is a fresh mutation object every render; only userId and
    // the settings this decision actually depends on should re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId,
    settingsQuery.isLoading,
    settingsQuery.data?.discoverable,
    settingsQuery.data?.radius_km,
  ]);
}

export function useUpdateMyLocationSettings() {
  const update = useServerFn(updateMyLocationSettings);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { discoverable: boolean; radius_km: LocationRadiusKm }) =>
      update({ data: input }),
    onSuccess: (row) => queryClient.setQueryData(LOCATION_KEY, row),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["nearby-profiles"] }),
  });
}

export function useDeleteMyLocation() {
  const remove = useServerFn(deleteMyLocation);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => remove(),
    onSuccess: () => queryClient.setQueryData(LOCATION_KEY, null),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["nearby-profiles"] }),
  });
}

export function useNearbyProfiles(enabled: boolean) {
  const list = useServerFn(listNearbyProfiles);
  return useQuery({
    queryKey: ["nearby-profiles"],
    queryFn: () => list({ data: { limit: 20 } }),
    enabled,
    staleTime: 30_000,
  });
}
