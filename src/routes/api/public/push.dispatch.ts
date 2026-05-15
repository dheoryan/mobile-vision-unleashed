import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { VAPID_PUBLIC_KEY } from "@/lib/push-subscribe";

type NotificationKind = "like" | "comment" | "reply" | "mention" | "follow" | "message";

const KIND_TEXT: Record<NotificationKind, string> = {
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  mention: "mentioned you",
  follow: "started following you",
  message: "sent you a message",
};

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.PUSH_DISPATCH_SECRET;
        if (!expected) return new Response("Not configured", { status: 500 });

        const provided = request.headers.get("x-push-secret") ?? "";
        if (!timingSafeEqualStr(provided, expected)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let body: { notification_id?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const notificationId = body.notification_id;
        if (!notificationId || typeof notificationId !== "string") {
          return new Response("Missing notification_id", { status: 400 });
        }

        // Load the notification
        const { data: notif, error: notifErr } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, actor_id, kind, post_id, preview")
          .eq("id", notificationId)
          .maybeSingle();
        if (notifErr || !notif) {
          return new Response("Notification not found", { status: 404 });
        }

        // Load actor profile (for name + avatar) and recipient handle when needed
        const { data: actor } = notif.actor_id
          ? await supabaseAdmin
              .from("profiles")
              .select("display_name, handle, avatar_url")
              .eq("id", notif.actor_id)
              .maybeSingle()
          : { data: null };

        const actorName = actor?.display_name?.trim() || "Someone";
        const kind = notif.kind as NotificationKind;
        const verb = KIND_TEXT[kind] ?? "sent you an update";

        let url = "/";
        if ((kind === "like" || kind === "comment" || kind === "reply" || kind === "mention") && notif.post_id) {
          url = `/?openPost=${encodeURIComponent(notif.post_id)}`;
        } else if (kind === "follow" && actor?.handle) {
          url = `/u/${encodeURIComponent(actor.handle)}`;
        } else if (kind === "message") {
          url = "/";
        }

        const payload = {
          title: `${actorName} ${verb}`,
          body: notif.preview ?? "",
          icon: actor?.avatar_url || "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          url,
          tag: `${kind}-${notif.post_id ?? notif.actor_id ?? notif.id}`,
        };

        // Fetch this user's subscriptions
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", notif.user_id);

        if (!subs || subs.length === 0) {
          return new Response(JSON.stringify({ delivered: 0 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        const vapid = {
          subject: process.env.VAPID_SUBJECT ?? "mailto:hello@example.com",
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        };

        let delivered = 0;
        await Promise.all(
          subs.map(async (s) => {
            try {
              const built = await buildPushPayload(
                { data: payload, options: { ttl: 60 * 60 * 24, urgency: "normal" } },
                {
                  endpoint: s.endpoint,
                  expirationTime: null,
                  keys: { auth: s.auth, p256dh: s.p256dh },
                },
                vapid,
              );

              const bodyBuf = built.body.buffer.slice(
                built.body.byteOffset,
                built.body.byteOffset + built.body.byteLength,
              ) as ArrayBuffer;
              const res = await fetch(s.endpoint, {
                method: built.method,
                headers: built.headers,
                body: bodyBuf,
              });

              if (res.status === 404 || res.status === 410) {
                // Subscription expired — clean up
                await supabaseAdmin
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", s.endpoint);
              } else if (res.ok || res.status === 201 || res.status === 202) {
                delivered++;
                await supabaseAdmin
                  .from("push_subscriptions")
                  .update({ last_used_at: new Date().toISOString() })
                  .eq("endpoint", s.endpoint);
              } else {
                console.warn("[push] non-ok response", res.status, await res.text().catch(() => ""));
              }
            } catch (err) {
              console.error("[push] send failed", err);
            }
          }),
        );

        return new Response(JSON.stringify({ delivered, total: subs.length }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
