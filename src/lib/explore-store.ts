import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExploreMatches } from "@/lib/explore.functions";

export const EXPLORE_PAGE_SIZE = 20;

/**
 * Scored Explore results. Paged, because the ranking is stable across offsets
 * (score, then updated_at, then id) so "Load more" cannot duplicate or skip.
 */
export function useExploreMatches(enabled = true) {
  const fetchMatches = useServerFn(listExploreMatches);
  return useInfiniteQuery({
    queryKey: ["explore", "matches"],
    queryFn: ({ pageParam }) =>
      fetchMatches({ data: { offset: pageParam as number, limit: EXPLORE_PAGE_SIZE } }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 30_000,
    enabled,
  });
}
