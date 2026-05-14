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
  bucket: "avatars" | "post-images",
  userId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (file.size > MAX_BYTES) throw new Error("Image too large (max 5 MB).");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(file)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export const uploadAvatar = (userId: string, file: File) =>
  uploadTo("avatars", userId, file);
export const uploadPostImage = (userId: string, file: File) =>
  uploadTo("post-images", userId, file);
