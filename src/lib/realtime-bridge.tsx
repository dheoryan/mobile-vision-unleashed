import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { FeedPost } from "@/lib/posts.functions";

const isLocalSupabaseRealtimeDisabled =
  import.meta.env.VITE_SUPABASE_URL?.includes("127.0.0.1") ||
  import.meta.env.VITE_SUPABASE_URL?.includes("localhost");

/** Patch a single counter field on every cached posts list that contains the post. */
function patchPostCount(
  qc: QueryClient,
  postId: string,
  field: "likes_count" | "replies_count" | "shares_count",
  delta: number,
) {
  qc.getQueriesData<unknown>({ queryKey: ["posts"] }).forEach(([key, data]) => {
    if (Array.isArray(data)) {
      const rows = data as FeedPost[];

      if (
        !rows.some(
          (p) => p && typeof p === "object" && "id" in p && p.id === postId,
        )
      ) {
        return;
      }

      qc.setQueryData(
        key,
        rows.map((p) =>
          p.id === postId
            ? { ...p, [field]: Math.max((p[field] ?? 0) + delta, 0) }
            : p,
        ),
      );

      return;
    }

    // Support useInfiniteQuery shapes: { pages: FeedPost[][], pageParams }
    if (data && typeof data === "object" && "pages" in (data as Record<string, unknown>)) {
      const infinite = data as { pages: FeedPost[][]; pageParams: unknown[] };

      if (!Array.isArray(infinite.pages)) return;

      let touched = false;

      const nextPages = infinite.pages.map((page) => {
        if (!Array.isArray(page)) return page;
        if (!page.some((p) => p?.id === postId)) return page;

        touched = true;

        return page.map((p) =>
          p.id === postId
            ? { ...p, [field]: Math.max((p[field] ?? 0) + delta, 0) }
            : p,
        );
      });

      if (touched) {
        qc.setQueryData(key, { ...infinite, pages: nextPages });
      }
    }
  });
}

/**
 * Subscribes to Postgres change events for the current user and invalidates
 * the related React Query caches so the UI updates instantly.
 */
export function RealtimeBridge() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (isLocalSupabaseRealtimeDisabled) {
      console.warn("[realtime] disabled in local dev to prevent websocket loop");
      return;
    }

    if (!user?.id) return;

    const uid = user.id;

    const channel = supabase
      .channel(`realtime:${uid}`)
      // DMs to me — refresh thread list + active conversation
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${uid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages"] });
          qc.invalidateQueries({ queryKey: ["unread-counts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${uid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages"] });
        },
      )
      // Likes on any post — counts come from posts table, but invalidate posts
      // so likes_count reflects when other users like
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "likes" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { post_id?: string } | undefined;

          if (row?.post_id) {
            const delta =
              payload.eventType === "INSERT"
                ? 1
                : payload.eventType === "DELETE"
                  ? -1
                  : 0;

            if (delta !== 0) {
              patchPostCount(qc, row.post_id, "likes_count", delta);
            }
          }

          qc.invalidateQueries({ queryKey: ["posts"] });
          qc.invalidateQueries({ queryKey: ["social", "likes"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      // Shares — keep shares_count and my-shares in sync across devices
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shares" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { post_id?: string } | undefined;

          if (row?.post_id) {
            const delta =
              payload.eventType === "INSERT"
                ? 1
                : payload.eventType === "DELETE"
                  ? -1
                  : 0;

            if (delta !== 0) {
              patchPostCount(qc, row.post_id, "shares_count", delta);
            }
          }

          qc.invalidateQueries({ queryKey: ["posts"] });
          qc.invalidateQueries({ queryKey: ["social", "shares"] });
        },
      )
      // Comments on any post — refresh comment lists + reply counts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { post_id?: string } | undefined;

          if (row?.post_id) {
            const delta =
              payload.eventType === "INSERT"
                ? 1
                : payload.eventType === "DELETE"
                  ? -1
                  : 0;

            if (delta !== 0) {
              patchPostCount(qc, row.post_id, "replies_count", delta);
            }

            qc.invalidateQueries({ queryKey: ["comments", row.post_id] });
          }

          qc.invalidateQueries({ queryKey: ["posts"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      // Posts table — keep counts in sync (triggers update likes_count/replies_count)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        () => {
          qc.invalidateQueries({ queryKey: ["posts"] });
        },
      )
      // Follows targeting me — refresh notifications + follow counts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `followee_id=eq.${uid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["social", "follow-counts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${uid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["social", "following"] });
          qc.invalidateQueries({ queryKey: ["social", "follow-counts"] });
          qc.invalidateQueries({ queryKey: ["posts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          qc.invalidateQueries({ queryKey: ["discover", "profiles"] });
          qc.invalidateQueries({ queryKey: ["ventures", "matches"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return null;
}