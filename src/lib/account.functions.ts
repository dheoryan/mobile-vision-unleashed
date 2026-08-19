import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Permanently deletes the calling user's account and their data.
 *
 * Most owned data (posts, comments, likes, follows, blocks, reports, tribe
 * messages/membership, push subscriptions, and venture applications/messages
 * where this user is the applicant/sender) cascades automatically via
 * `ON DELETE CASCADE` once the underlying `auth.users` row is removed.
 *
 * A handful of tables were created without a foreign key back to
 * profiles/auth.users (`messages`, `notifications`, `shares`, `saved_posts`,
 * `ventures`) — those are cleaned up explicitly first so no orphaned rows
 * survive the account's own deletion. Deleting this user's `ventures` rows
 * also cascades to any `venture_applications`/`venture_messages` tied to
 * those specific ventures (including other people's applications to them),
 * since those two tables *do* have a real FK to `ventures.id`.
 *
 * Requires the service-role client (`supabaseAdmin`) because
 * `auth.admin.deleteUser` isn't reachable via the anon/authenticated client,
 * and because RLS on some of these tables isn't guaranteed to grant a user
 * DELETE on rows they merely participate in (e.g. `messages` as recipient).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    // Tables with no DB-level FK/cascade back to the user — clean up manually.
    const { error: messagesError } = await supabaseAdmin
      .from("messages")
      .delete()
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    if (messagesError) throw new Error(messagesError.message);

    const { error: notificationsError } = await supabaseAdmin
      .from("notifications")
      .delete()
      .or(`user_id.eq.${userId},actor_id.eq.${userId}`);
    if (notificationsError) throw new Error(notificationsError.message);

    const { error: sharesError } = await supabaseAdmin
      .from("shares")
      .delete()
      .eq("user_id", userId);
    if (sharesError) throw new Error(sharesError.message);

    const { error: savedPostsError } = await supabaseAdmin
      .from("saved_posts")
      .delete()
      .eq("user_id", userId);
    if (savedPostsError) throw new Error(savedPostsError.message);

    const { error: venturesError } = await supabaseAdmin
      .from("ventures")
      .delete()
      .eq("user_id", userId);
    if (venturesError) throw new Error(venturesError.message);

    // Deleting the auth user cascades everything declared ON DELETE CASCADE:
    // profiles, posts, comments, likes, follows, blocks, reports,
    // venture_applications (as applicant), venture_messages (as sender),
    // tribe_members, tribe_messages, push_subscriptions.
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) throw new Error(deleteUserError.message);

    return { ok: true as const };
  });
