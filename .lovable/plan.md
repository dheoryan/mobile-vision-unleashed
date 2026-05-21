## Goal
Tighten the optimistic insert in `useCreatePost` so a new post only appears in feed caches where it actually belongs, matching the RLS visibility rules.

## Change
In `src/lib/posts-store.ts`, update `useCreatePost`'s `onMutate` to filter which cached feed queries receive the optimistic post, instead of prepending to every `["posts", ...]` list.

Rules for inserting the optimistic post into a cached query:
- `["posts", "feed", "all"]` → always insert (global feed shows everything).
- `["posts", "feed", <tribeId>]` →
  - insert if `audience === "all"` (broadcast shows in every tribe feed), OR
  - insert if `<tribeId> === input.tribe_id` (tribe-only post belongs to its own tribe feed).
  - otherwise skip.
- `["posts", "mine", ...]` → always insert (author always sees own post).
- `["posts", "saved"]` / `["posts", "saved-ids"]` → skip (new post isn't saved yet).
- Any other `["posts", ...]` key → skip by default (safer than over-inserting).

Implementation detail: replace the current `patchListsWith` call inside `onMutate` with a small inline loop over `qc.getQueriesData({ queryKey: ["posts"] })` that inspects the query key shape and decides per-cache whether to prepend. `onSuccess` and `onError` can keep using `patchListsWith` (they operate on posts already inserted by `onMutate`, so they're naturally scoped).

## Notes
- No DB, no RLS, no server-fn changes — purely client cache hygiene.
- `onSettled` still calls `invalidateAllPostLists`, so any drift self-heals on the next refetch.
- No UI copy changes.
