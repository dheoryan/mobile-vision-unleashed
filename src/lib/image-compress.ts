// Client-side image compression for post uploads.
// Keeps good resolution while reducing file size.

export type CompressOptions = {
  maxDimension?: number; // max width/height in px
  quality?: number; // 0..1 for jpeg/webp
  mimeType?: "image/jpeg" | "image/webp";
};

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 2048,
  quality: 0.85,
  mimeType: "image/jpeg",
};

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  // Skip compression for GIFs (preserve animation) and tiny images.
  if (file.type === "image/gif") return file;

  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...opts };

  const bitmap = await loadBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, mimeType, quality),
  );
  if (!blob) return file;

  // If compression somehow made it bigger, keep the original.
  if (blob.size >= file.size && file.type.startsWith("image/")) return file;

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function fitWithin(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function loadBitmap(
  file: File,
): Promise<ImageBitmap | (HTMLImageElement & { close?: () => void })> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return img as HTMLImageElement & { close?: () => void };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
