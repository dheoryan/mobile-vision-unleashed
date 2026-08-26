import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { listTribeMembers } from "@/lib/tribe-members.functions";

export function useTribeMembers(tribeId: string, enabled = true) {
  const { user } = useAuth();
  const fn = useServerFn(listTribeMembers);
  return useQuery({
    queryKey: ["tribes", tribeId, "members", user?.id ?? null],
    queryFn: () => fn({ data: { tribe_id: tribeId } }),
    enabled: enabled && !!user && !!tribeId,
    staleTime: 60_000,
  });
}
