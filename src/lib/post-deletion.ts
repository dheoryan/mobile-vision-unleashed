import type { MutationObserverOptions, QueryClient, QueryKey } from "@tanstack/react-query";

type Post = { id: string };
type Snapshot = { key: QueryKey; removed: { post: Post; index: number }[] };

/** Mutation callbacks belong to the mutation, so feedback survives the
 * optimistic removal unmounting the PostCard that started the request. */
export function postDeletionOptions(
  qc: QueryClient,
  remove: (input: { id: string }) => Promise<unknown>,
  feedback: { success: (message: string) => void; error: (message: string) => void },
): MutationObserverOptions<unknown, Error, { id: string }, { snapshots: Snapshot[] }> {
  return {
    mutationFn: remove,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      // Snapshot each list independently to avoid duplicate restoration or
      // inserting a profile's post into a different audience's feed.
      const snapshots = qc
        .getQueriesData<Post[]>({ queryKey: ["posts"] })
        .flatMap(([key, rows]) => {
          const removed =
            rows?.flatMap((post, index) => (post.id === input.id ? [{ post, index }] : [])) ?? [];
          if (!removed.length) return [];
          qc.setQueryData(
            key,
            rows!.filter((post) => post.id !== input.id),
          );
          return [{ key, removed }];
        });
      return { snapshots };
    },
    onSuccess: () => feedback.success("Post deleted"),
    onError: (error, _input, ctx) => {
      for (const { key, removed } of ctx?.snapshots ?? []) {
        qc.setQueryData<Post[]>(key, (rows) => {
          if (!rows) return rows;
          const restored = [...rows];
          for (const { post, index } of removed) {
            if (!restored.some((row) => row.id === post.id)) {
              restored.splice(Math.min(index, restored.length), 0, post);
            }
          }
          return restored;
        });
      }
      feedback.error(
        error instanceof Error ? error.message : "Couldn't delete post. Please try again.",
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["posts"] });
    },
  };
}
