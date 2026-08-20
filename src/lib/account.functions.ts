import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STORAGE_PAGE_SIZE = 100;
const STORAGE_REMOVE_BATCH_SIZE = 100;

function objectPath(prefix: string, name: string) {
  return prefix ? `${prefix}/${name}` : name;
}

async function listStorageFolder(bucket: string, prefix: string) {
  const entries: Array<{ id?: string | null; name: string }> = [];

  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
      limit: STORAGE_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Could not list ${bucket} files: ${error.message}`);

    entries.push(...(data ?? []));
    if ((data?.length ?? 0) < STORAGE_PAGE_SIZE) break;
  }

  return entries;
}

async function listStorageFilesRecursively(bucket: string, prefix: string): Promise<string[]> {
  const entries = await listStorageFolder(bucket, prefix);
  const files: string[] = [];

  for (const entry of entries) {
    const path = objectPath(prefix, entry.name);
    if (entry.id) {
      files.push(path);
    } else {
      files.push(...(await listStorageFilesRecursively(bucket, path)));
    }
  }

  return files;
}

async function removeStorageFiles(bucket: string, paths: string[]) {
  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await supabaseAdmin.storage.from(bucket).remove(batch);
    if (error) throw new Error(`Could not delete ${bucket} files: ${error.message}`);
  }
}

async function removeUserStorage(userId: string) {
  const [avatarPaths, postImagePaths, tribeRoots] = await Promise.all([
    listStorageFilesRecursively("avatars", userId),
    listStorageFilesRecursively("post-images", userId),
    listStorageFolder("tribe-chat-attachments", ""),
  ]);

  // Current Tribe attachments are stored as
  // <tribe-id>/<user-id>-<timestamp>-<suffix>. Enumerate every root folder so
  // uploads remain discoverable even if a Tribe DB row no longer exists. Also
  // accept a nested <tribe-id>/<user-id>/ legacy shape defensively.
  const tribeAttachmentPaths = (
    await Promise.all(
      tribeRoots
        .filter((entry) => !entry.id)
        .map(async (entry) => {
          const tribeEntries = await listStorageFolder("tribe-chat-attachments", entry.name);
          const currentPaths = tribeEntries
            .filter((item) => !!item.id && item.name.startsWith(`${userId}-`))
            .map((item) => objectPath(entry.name, item.name));
          const legacyUserFolder = tribeEntries.find(
            (item) => !item.id && item.name === userId,
          );
          if (!legacyUserFolder) return currentPaths;

          const legacyPaths = await listStorageFilesRecursively(
            "tribe-chat-attachments",
            `${entry.name}/${userId}`,
          );
          return [...currentPaths, ...legacyPaths];
        }),
    )
  ).flat();

  await removeStorageFiles("avatars", avatarPaths);
  await removeStorageFiles("post-images", postImagePaths);
  await removeStorageFiles("tribe-chat-attachments", tribeAttachmentPaths);

  return avatarPaths.length + postImagePaths.length + tribeAttachmentPaths.length;
}

/**
 * Permanently deletes the calling user's account and their data.
 *
 * Most owned data (posts, comments, likes, follows, blocks, tribe
 * messages/membership, push subscriptions, and venture applications/messages
 * where this user is the applicant/sender) cascades automatically via
 * `ON DELETE CASCADE` once the underlying `auth.users` row is removed.
 * Reports are the intentional exception: they are retained as moderation
 * evidence, with reporter identity anonymized by the database migration.
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
  .inputValidator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }) => {
    const { userId } = context;

    // Storage is outside Postgres and does not participate in FK cascades.
    // Remove it first so a later database failure cannot leave public or
    // signed-URL-accessible uploads orphaned after the account disappears.
    const deletedStorageObjects = await removeUserStorage(userId);

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
    // profiles, posts, comments, likes, follows, blocks,
    // venture_applications (as applicant), venture_messages (as sender),
    // tribe_members, tribe_messages, push_subscriptions.
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) throw new Error(deleteUserError.message);

    return { ok: true as const, deletedStorageObjects };
  });
