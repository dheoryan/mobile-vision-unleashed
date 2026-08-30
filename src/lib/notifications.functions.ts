import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachPostImageUrls, type AuthorLite } from "@/lib/posts.functions";

const AUTHOR_COLS = "id, display_name, handle, avatar_emoji, avatar_url, plan";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  | "quote"
  | "comment_like"
  | "comment_repost";

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
  /** Human-readable room name for group-chat activity. Hydrated after the
   * notification query so the database row remains a small routing record. */
  conversation_name: string | null;
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

    const ventureIds = Array.from(
      new Set(
        ((rows ?? []) as Array<{ venture_id: string | null }>)
          .map((row) => row.venture_id)
          .filter(Boolean) as string[],
      ),
    );
    const ventureNameMap = new Map<string, string>();
    if (ventureIds.length) {
      const { data: ventures, error: venturesError } = await supabase
        .from("ventures")
        .select("id, title")
        .in("id", ventureIds);
      if (venturesError) throw new Error(venturesError.message);
      for (const venture of ventures ?? []) ventureNameMap.set(venture.id, venture.title);
    }

    const tribeIds = Array.from(
      new Set(
        ((rows ?? []) as Array<{ tribe_id: string | null }>)
          .map((row) => row.tribe_id)
          .filter(Boolean) as string[],
      ),
    );
    const tribeNameMap = new Map<string, string>();
    if (tribeIds.length) {
      // `notifications.tribe_id` contains the stable Tribe key (`cat`, `owl`,
      // etc.) for current chat rows, while a few legacy rows may contain the
      // table UUID. Split the lookups so Postgres never receives `cat` as a
      // UUID input.
      const tribeUuids = tribeIds.filter((id) => UUID_PATTERN.test(id));
      const tribeKeys = tribeIds.filter((id) => !UUID_PATTERN.test(id));
      const [uuidResult, keyResult] = await Promise.all([
        tribeUuids.length
          ? supabase.from("tribes").select("id, key, name").in("id", tribeUuids)
          : Promise.resolve({ data: [], error: null }),
        tribeKeys.length
          ? supabase.from("tribes").select("id, key, name").in("key", tribeKeys)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (uuidResult.error) throw new Error(uuidResult.error.message);
      if (keyResult.error) throw new Error(keyResult.error.message);
      for (const tribe of [...(uuidResult.data ?? []), ...(keyResult.data ?? [])]) {
        if (!tribe.name) continue;
        tribeNameMap.set(tribe.id, tribe.name);
        if (tribe.key) tribeNameMap.set(tribe.key, tribe.name);
      }
    }

    return (
      (rows ?? []) as Omit<NotificationRow, "actor" | "conversation_name" | "post_image_url">[]
    ).map((r) => ({
      ...r,
      actor: r.actor_id ? (actorMap.get(r.actor_id) ?? null) : null,
      conversation_name: r.venture_id
        ? (ventureNameMap.get(r.venture_id) ?? null)
        : r.tribe_id
          ? (tribeNameMap.get(r.tribe_id) ?? null)
          : null,
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

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ids = Array.from(new Set(data.ids));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ids };
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
