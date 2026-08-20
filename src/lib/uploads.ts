import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

function extOf(file: File): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(file.name);
  if (m) return m[1].toLowerCase();
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

async function uploadTo(
  bucket: "avatars" | "post-images" | "tribe-chat-attachments" | "venture-images",
  userId: string,
  file: File,
  prefix = userId,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (file.size > MAX_BYTES) throw new Error("Image too large (max 5 MB).");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(file)}`;
  const path = prefix === userId ? `${userId}/${suffix}` : `${prefix}/${userId}-${suffix}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  // Private buckets store an object path; authorized callers resolve a signed URL at render time.
  if (
    bucket === "tribe-chat-attachments" ||
    bucket === "post-images" ||
    bucket === "venture-images"
  ) {
    return path;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export const uploadAvatar = (userId: string, file: File) => uploadTo("avatars", userId, file);
export const uploadPostImage = (userId: string, file: File) =>
  uploadTo("post-images", userId, file);
export const uploadTribeChatImage = (tribeId: string, userId: string, file: File) =>
  uploadTo("tribe-chat-attachments", userId, file, tribeId);
export const uploadVentureImage = (userId: string, file: File) =>
  uploadTo("venture-images", userId, file);

const VENTURE_BUCKET = "venture-images";

/**
 * Signed URL for a Venture thumbnail, valid one hour.
 *
 * The bucket is private because a scope='mine' Venture is Tribe-only — a
 * public URL would hand its photo to anyone with the link and silently undo
 * that scoping. Storage RLS decides whether the caller gets a URL at all, so a
 * null here means "not allowed to see it", not "broken".
 */
export async function signVentureImageUrl(value: string): Promise<string | null> {
  const marker = `/${VENTURE_BUCKET}/`;
  const i = value.indexOf(marker);
  const path = i >= 0 ? decodeURIComponent(value.slice(i + marker.length)) : value;
  const { data, error } = await supabase.storage.from(VENTURE_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

const TRIBE_BUCKET = "tribe-chat-attachments";

/** Accepts either a stored object path or a legacy public URL and returns the object path. */
export function tribeAttachmentPath(value: string): string {
  const marker = `/${TRIBE_BUCKET}/`;
  const i = value.indexOf(marker);
  if (i >= 0) return decodeURIComponent(value.slice(i + marker.length));
  return value;
}

/** Signed URL for a private tribe chat attachment (valid 1 hour). */
export async function signTribeChatUrl(value: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(TRIBE_BUCKET)
    .createSignedUrl(tribeAttachmentPath(value), 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
