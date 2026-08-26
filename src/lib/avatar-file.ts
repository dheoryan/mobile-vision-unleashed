export const MAX_AVATAR_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_EXTENSION = /\.(?:avif|gif|heic|heif|jpe?g|png|webp)$/i;
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

export type AvatarFileIssue = "not-image" | "too-large" | null;

/**
 * Android content providers do not always return a useful MIME type. Allow a
 * known image extension when the provider supplies no type (or the generic
 * binary type), then let the browser's image decoder validate the contents.
 */
export function avatarFileIssue(file: Pick<File, "name" | "size" | "type">): AvatarFileIssue {
  if (file.size > MAX_AVATAR_IMAGE_BYTES) return "too-large";

  const hasImageMime = file.type.toLowerCase().startsWith("image/");
  const hasImageExtension = IMAGE_EXTENSION.test(file.name);
  if (!hasImageMime && !(GENERIC_MIME_TYPES.has(file.type.toLowerCase()) && hasImageExtension)) {
    return "not-image";
  }

  return null;
}
