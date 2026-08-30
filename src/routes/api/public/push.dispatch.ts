import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPushCopy, pushNotificationTag, type PushNotificationKind } from "@/lib/push-payload";
import {
  allowsPushKind,
  DEFAULT_PUSH_PREFERENCES,
  type PushPreferences,
} from "@/lib/push-preferences";
import { VAPID_PUBLIC_KEY } from "@/lib/push-subscribe";

type PushDeliveryStatus = "skipped" | "delivered" | "partial" | "failed";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function recordDelivery(
  notificationId: string,
  status: PushDeliveryStatus,
  delivered: number,
  failed: number,
) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({
      push_attempted_at: new Date().toISOString(),
      push_status: status,
      push_delivered_count: delivered,
      push_failed_count: failed,
    })
    .eq("id", notificationId);
  if (error) {
    console.error(
      "[push] delivery status write failed",
      JSON.stringify({ notificationId, code: error.code }),
    );
  }
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
        if (
          !notificationId ||
          typeof notificationId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            notificationId,
          )
        ) {
          return new Response("Missing notification_id", { status: 400 });
        }

        // Load the notification
        const { data: notif, error: notifErr } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, actor_id, kind, post_id, venture_id, preview")
          .eq("id", notificationId)
          .maybeSingle();
        if (notifErr || !notif) {
          return new Response("Notification not found", { status: 404 });
        }

        // Load actor profile (for name + avatar) and recipient handle when needed
        const { data: actor } = notif.actor_id
          ? await supabaseAdmin
              .from("profiles")
              .select("display_name, handle")
              .eq("id", notif.actor_id)
              .maybeSingle()
          : { data: null };

        const actorName = actor?.display_name?.trim() || "Someone";
        const kind = notif.kind as PushNotificationKind;
        const copy = buildPushCopy(actorName, kind, notif.preview);

        // Route every push through the activity inbox with the source row in
        // the URL. The screen marks just that row read and applies the same
        // typed destination logic as an in-app tap. The previous `openPost`
        // query parameter was never consumed anywhere, while most kinds simply
        // opened the home tab and lost their context.
        const url = `/notifications?open=${encodeURIComponent(notif.id)}`;

        const payload = {
          title: copy.title,
          body: copy.body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          url,
          tag: pushNotificationTag(kind, {
            notificationId: notif.id,
            postId: notif.post_id,
            actorId: notif.actor_id,
            ventureId: notif.venture_id,
          }),
        };

        // Missing rows intentionally use product defaults. A preference lookup
        // failure fails closed so a temporary database problem cannot bypass a
        // member's explicit opt-out.
        const { data: storedPreferences, error: preferencesError } = await supabaseAdmin
          .from("push_notification_preferences")
          .select("messages_mentions, venture_activity, social_activity, tribe_activity, new_posts")
          .eq("user_id", notif.user_id)
          .maybeSingle();
        if (preferencesError) {
          await recordDelivery(notif.id, "failed", 0, 1);
          console.error(
            "[push] preference lookup failed",
            JSON.stringify({ notificationId: notif.id, code: preferencesError.code }),
          );
          return new Response(
            JSON.stringify({ delivered: 0, reason: "preference_lookup_failed" }),
            {
              status: 502,
              headers: { "content-type": "application/json" },
            },
          );
        }

        const preferences: PushPreferences = {
          ...DEFAULT_PUSH_PREFERENCES,
          ...(storedPreferences ?? {}),
        };
        if (!allowsPushKind(kind, preferences)) {
          await recordDelivery(notif.id, "skipped", 0, 0);
          return new Response(JSON.stringify({ delivered: 0, reason: "category_disabled" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        // Fetch this user's subscriptions
        const { data: subs, error: subsError } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", notif.user_id);

        if (subsError) {
          await recordDelivery(notif.id, "failed", 0, 1);
          console.error(
            "[push] subscription lookup failed",
            JSON.stringify({ notificationId: notif.id, code: subsError.code }),
          );
          return new Response(JSON.stringify({ delivered: 0, total: 0 }), {
            status: 502,
            headers: { "content-type": "application/json" },
          });
        }

        if (!subs || subs.length === 0) {
          await recordDelivery(notif.id, "skipped", 0, 0);
          return new Response(JSON.stringify({ delivered: 0 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (!privateKey) {
          await recordDelivery(notif.id, "failed", 0, subs.length);
          console.error(
            "[push] VAPID_PRIVATE_KEY is not configured",
            JSON.stringify({ notificationId: notif.id }),
          );
          return new Response(JSON.stringify({ delivered: 0, total: subs.length }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }

        const vapid = {
          subject: process.env.VAPID_SUBJECT ?? "mailto:hello@example.com",
          publicKey: VAPID_PUBLIC_KEY,
          privateKey,
        };

        const results = await Promise.all(
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
                signal: AbortSignal.timeout(10_000),
              });

              if (res.status === 404 || res.status === 410) {
                // Subscription expired — clean up
                await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                return "expired" as const;
              } else if (res.ok || res.status === 201 || res.status === 202) {
                await supabaseAdmin
                  .from("push_subscriptions")
                  .update({ last_used_at: new Date().toISOString() })
                  .eq("endpoint", s.endpoint);
                return "delivered" as const;
              } else {
                console.warn(
                  "[push] non-ok response",
                  JSON.stringify({ notificationId: notif.id, status: res.status }),
                );
                return "failed" as const;
              }
            } catch (err) {
              console.error(
                "[push] send failed",
                JSON.stringify({
                  notificationId: notif.id,
                  error: err instanceof Error ? err.message : "Unknown error",
                }),
              );
              return "failed" as const;
            }
          }),
        );

        const delivered = results.filter((result) => result === "delivered").length;
        const failed = results.length - delivered;
        const status: PushDeliveryStatus =
          delivered === results.length ? "delivered" : delivered > 0 ? "partial" : "failed";
        await recordDelivery(notif.id, status, delivered, failed);

        return new Response(JSON.stringify({ delivered, total: subs.length }), {
          status: delivered > 0 ? 200 : 502,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
