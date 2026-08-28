import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPushPreferences, updateMyPushPreference } from "@/lib/push-preferences.functions";
import {
  DEFAULT_PUSH_PREFERENCES,
  type PushPreferenceKey,
  type PushPreferences,
} from "@/lib/push-preferences";

const PUSH_PREFERENCES_KEY = ["push-preferences"] as const;

export function usePushPreferences() {
  const getPreferences = useServerFn(getMyPushPreferences);
  return useQuery({
    queryKey: PUSH_PREFERENCES_KEY,
    queryFn: () => getPreferences(),
    staleTime: 60_000,
  });
}

export function useUpdatePushPreference() {
  const updatePreference = useServerFn(updateMyPushPreference);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { key: PushPreferenceKey; enabled: boolean }) =>
      updatePreference({ data: input }),
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: PUSH_PREFERENCES_KEY });
      const previous = queryClient.getQueryData<PushPreferences>(PUSH_PREFERENCES_KEY);
      queryClient.setQueryData<PushPreferences>(PUSH_PREFERENCES_KEY, {
        ...(previous ?? DEFAULT_PUSH_PREFERENCES),
        [key]: enabled,
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PUSH_PREFERENCES_KEY, context.previous);
      } else {
        queryClient.removeQueries({ queryKey: PUSH_PREFERENCES_KEY });
      }
    },
    onSuccess: (preferences) => queryClient.setQueryData(PUSH_PREFERENCES_KEY, preferences),
    onSettled: () => queryClient.invalidateQueries({ queryKey: PUSH_PREFERENCES_KEY }),
  });
}
