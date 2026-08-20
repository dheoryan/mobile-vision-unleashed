import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const isLocalSupabaseRealtimeDisabled =
  import.meta.env.VITE_SUPABASE_URL?.includes("127.0.0.1") ||
  import.meta.env.VITE_SUPABASE_URL?.includes("localhost");

/**
 * Subscribes to Postgres change events **for the current user only** and
 * invalidates the related React Query caches.
 *
 * PERFORMANCE NOTE — read before adding a binding here.
 *
 * This file previously also subscribed every client to `likes`, `shares`,
 * `comments`, `posts` (UPDATE) and `profiles` with NO `filter:` — i.e. every
 * user received every one of those events platform-wide, and each handler
 * called `invalidateQueries(["posts"])`.
 *
 * That did not scale. Because the counter triggers also UPDATE the post row,
 * a single like produced two global broadcast events, and TimelineScreen
 * mounts two feed queries. At ~1,000 concurrent users generating ~7 writes/sec
 * that works out to ~14,000 outbound realtime messages/sec and roughly 5,000
 * `listFeed` executions/sec — the app fell over in the low hundreds of users.
 *
 * Every binding below MUST carry a `filter:` scoping it to this user. If you
 * need live updates for a shared object (a post's like count, an open comment
 * thread), subscribe to that specific object from the component that displays
 * it, and unsubscribe when it unmounts — do not add a global table binding.
 *
 * Counts stay fresh via each query's `staleTime` plus the optimistic updates
 * already implemented in the mutation hooks.
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
      // Anything addressed to me — likes, comments, follows, venture activity all
      // land here, so this covers the "someone interacted with my stuff" case
      // without needing a global binding on each source table.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      // Follows targeting me — refresh follow counts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `followee_id=eq.${uid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["social", "follow-counts"] });
        },
      )
      // My own follows — keep the following set in sync across devices
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${uid}` },
        () => {
          qc.invalidateQueries({ queryKey: ["social", "following"] });
          qc.invalidateQueries({ queryKey: ["social", "follow-counts"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return null;
}
