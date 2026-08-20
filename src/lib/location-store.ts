import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteMyLocation,
  getMyLocationSettings,
  listNearbyProfiles,
  saveMyLocation,
  updateMyLocationSettings,
} from "@/lib/location.functions";
import type { BrowserLocation, LocationRadiusKm } from "@/lib/location";

const LOCATION_KEY = ["my-location"] as const;

export function useMyLocationSettings() {
  const getSettings = useServerFn(getMyLocationSettings);
  return useQuery({ queryKey: LOCATION_KEY, queryFn: () => getSettings(), staleTime: 60_000 });
}

export function useSaveMyLocation() {
  const save = useServerFn(saveMyLocation);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BrowserLocation & { radius_km: LocationRadiusKm; discoverable?: boolean }) =>
      save({ data: { ...input, discoverable: input.discoverable ?? true } }),
    onSuccess: (row) => queryClient.setQueryData(LOCATION_KEY, row),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["nearby-profiles"] }),
  });
}

export function useUpdateMyLocationSettings() {
  const update = useServerFn(updateMyLocationSettings);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { discoverable: boolean; radius_km: LocationRadiusKm }) => update({ data: input }),
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

