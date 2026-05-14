import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Subscribes to Postgres change events for the current user and invalidates
 * the related React Query caches so the UI updates instantly.
 */
export function RealtimeBridge() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
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
        () => {
          qc.invalidateQueries({ queryKey: ["posts"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      // Comments on any post — refresh comment lists + reply counts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { post_id?: string } | undefined;
          if (row?.post_id) {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return null;
}
