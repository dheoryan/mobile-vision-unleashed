import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Scored discovery.
 *
 * Replaces the `order by created_at desc` fallback that Explore was really
 * running for anyone who had not opted into location sharing — which, at
 * launch, is nearly everybody. Ranking happens in Postgres
 * (`list_explore_matches`), which also returns the signals it matched on so
 * the card can say *why* rather than showing a bare percentage.
 */

export type ExploreMatch = {
  id: string;
  display_name: string;
  handle: string | null;
  city: string;
  bio: string;
  avatar_emoji: string;
  avatar_url: string | null;
  tribe_ids: string[];
  interests: string[];
  social_intents: string[];
  availability: string[];
  plan: "free" | "plus";
  /** 0-100. */
  match_score: number;
  shared_interests: string[];
  shared_intents: string[];
  shared_availability: string[];
  same_tribe: boolean;
  /** Coarse band, and only inside the mutual radius. Null otherwise. */
  distance_band: string | null;
  /** True only when both people's locations are known and the distance is
   *  confirmed to exceed the mutual radius - distinct from "unknown"
   *  (nobody, or only one side, has opted into Nearby), which stays false.
   *  Confirmed-in-radius candidates always rank ahead of everyone else;
   *  this is what lets the client label a fallback card honestly instead
   *  of just silently omitting the distance chip. */
  outside_radius: boolean;
  open_venture_id: string | null;
  open_venture_title: string | null;
};

export type ExplorePage = {
  rows: ExploreMatch[];
  nextOffset: number | null;
};

type MatchRow = {
  profile_id: string;
  score: number;
  shared_interests: string[] | null;
  shared_intents: string[] | null;
  shared_availability: string[] | null;
  same_tribe: boolean | null;
  distance_band: string | null;
  outside_radius: boolean | null;
  open_venture_id: string | null;
  open_venture_title: string | null;
};

export const listExploreMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        offset: z.number().int().min(0).max(10_000).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ExplorePage> => {
    const { supabase } = context;
    const limit = data.limit ?? 20;
    const offset = data.offset ?? 0;

    // `list_explore_matches` is not in the generated types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as any;
    const { data: matches, error: matchError } = await db.rpc("list_explore_matches", {
      _limit: limit,
      _offset: offset,
    });
    if (matchError) throw new Error(matchError.message);

    const rows = (matches ?? []) as MatchRow[];
    if (!rows.length) return { rows: [], nextOffset: null };

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, handle, city, bio, avatar_emoji, avatar_url, tribe_ids, interests, social_intents, availability, plan",
      )
      .in(
        "id",
        rows.map((r) => r.profile_id),
      );
    if (error) throw new Error(error.message);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Preserve the RPC's ordering; `.in()` does not guarantee it.
    const merged = rows.flatMap((match) => {
      const profile = byId.get(match.profile_id);
      if (!profile) return [];
      return [
        {
          ...profile,
          match_score: match.score,
          shared_interests: match.shared_interests ?? [],
          shared_intents: match.shared_intents ?? [],
          shared_availability: match.shared_availability ?? [],
          same_tribe: match.same_tribe ?? false,
          distance_band: match.distance_band,
          outside_radius: match.outside_radius ?? false,
          open_venture_id: match.open_venture_id,
          open_venture_title: match.open_venture_title,
        } as ExploreMatch,
      ];
    });

    return {
      rows: merged,
      // Page off the RPC's row count, not the merged count: a profile dropped
      // by RLS in the join above should not look like the end of the pool.
      nextOffset: rows.length === limit ? offset + limit : null,
    };
  });

/**
 * Records that these people were just shown in Today's Five (or a
 * continuation set), so `list_explore_matches` can push them down the
 * ranking for a while instead of the same top scorers showing up forever.
 * Upsert, not an append-only log - only the most recent time matters.
 */
export const recordExploreImpressions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ shown_ids: z.array(z.string().uuid()).min(1).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("explore_impressions").upsert(
      data.shown_ids.map((shownId) => ({
        user_id: userId,
        shown_id: shownId,
        shown_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,shown_id" },
    );
    if (error) throw new Error(error.message);
    return { recorded: data.shown_ids.length };
  });
