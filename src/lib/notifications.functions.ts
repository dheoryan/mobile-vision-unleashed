import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachPostImageUrls, type AuthorLite } from "@/lib/posts.functions";

const AUTHOR_COLS = "id, display_name, handle, avatar_emoji, avatar_url, plan";

export type NotificationKind =
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "follow"
  | "message"
  | "new_post"
  | "venture_apply"
  | "venture_invite"
  | "venture_accept"
  | "venture_message"
  | "tribe_join"
  | "hello"
  | "hello_accepted"
  | "repost"
  | "quote";

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NotificationKind;
  post_id: string | null;
  comment_id: string | null;
  message_id: string | null;
  venture_id: string | null;
  tribe_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
  actor: AuthorLite | null;
  /** Short-lived signed URL for the related post's image, when it has one -
   *  Instagram-style thumbnail on the notification row. Never persisted. */
  post_image_url: string | null;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("notifications")
      .select(
        "id, user_id, actor_id, kind, post_id, comment_id, message_id, venture_id, tribe_id, preview, read_at, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);

    const actorIds = Array.from(
      new Set(
        ((rows ?? []) as Array<{ actor_id: string | null }>)
          .map((r) => r.actor_id)
          .filter(Boolean) as string[],
      ),
    );
    const actorMap = new Map<string, AuthorLite>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select(AUTHOR_COLS)
        .in("id", actorIds);
      for (const a of (profs ?? []) as AuthorLite[]) actorMap.set(a.id, a);
    }

    const postIds = Array.from(
      new Set(
        ((rows ?? []) as Array<{ post_id: string | null }>)
          .map((r) => r.post_id)
          .filter(Boolean) as string[],
      ),
    );
    const postImageMap = new Map<string, string | null>();
    if (postIds.length) {
      const { data: posts } = await supabase
        .from("posts")
        .select("id, image_url")
        .in("id", postIds);
      const hydrated = await attachPostImageUrls(
        supabase,
        (posts ?? []) as { id: string; image_url: string | null }[],
      );
      for (const p of hydrated) postImageMap.set(p.id, p.image_url);
    }

    return ((rows ?? []) as Omit<NotificationRow, "actor" | "post_image_url">[]).map((r) => ({
      ...r,
      actor: r.actor_id ? (actorMap.get(r.actor_id) ?? null) : null,
      post_image_url: r.post_id ? (postImageMap.get(r.post_id) ?? null) : null,
    }));
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("notifications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });
