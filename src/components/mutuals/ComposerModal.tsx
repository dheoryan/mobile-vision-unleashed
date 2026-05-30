import { useRef, useState } from "react";
import { X, ImagePlus, Camera, Loader2 } from "lucide-react";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { useCreatePost } from "@/lib/posts-store";
import { uploadPostImage } from "@/lib/uploads";
import { compressImage } from "@/lib/image-compress";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { requestPushPrompt } from "@/lib/push-prompt-events";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB pre-compression cap

export type Audience = "tribe" | "all";

export function ComposerModal({
  open, onClose, tribeId, initialAudience = "tribe",
}: { open: boolean; onClose: () => void; tribeId: TribeId; initialAudience?: Audience }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const createPost = useCreatePost();

  if (!open) return null;
  const tribe = tribeById(tribeId);
  const effectiveAudience: Audience = initialAudience;

  const reset = () => { setText(""); setImageUrl(null); };

  const submit = () => {
    const t = text.trim();
    if (!t && !imageUrl) return;
    if (uploading) return;
    createPost.mutate(
      {
        tribe_id: tribeId,
        content: t,
        image_url: imageUrl ?? null,
        audience: effectiveAudience,
      },
      {
        onError: (e) => toast.error((e as Error).message),
      },
    );
    if (effectiveAudience === "all") {
      toast.success(`Signal sent to all your Tribes`);
    } else {
      toast.success("Posted to " + tribe.name);
    }
    requestPushPrompt("post");
    reset();
    onClose();
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    if (!f.type.startsWith("image/")) { toast.error("Only image files."); return; }
    if (f.size > MAX_BYTES) { toast.error("Image too large", { description: "Max 15 MB." }); return; }
    setUploading(true);
    try {
      const compressed = await compressImage(f, { maxDimension: 2048, quality: 0.85 });
      const url = await uploadPostImage(user.id, compressed);
      setImageUrl(url);
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const close = () => { reset(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={close} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 animate-rise">
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <p className="label-mono text-muted-foreground">New post · {effectiveAudience === "all" ? "All Tribes" : tribe.name}</p>
        <h2 className="font-display text-xl font-bold">What's happening?</h2>

        {canBroadcast && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setAudience("tribe")}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1.5 transition",
                audience === "tribe" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              style={audience === "tribe" ? { backgroundColor: tribe.colorVar } : undefined}
            >
              <Users className="h-3 w-3" /> {tribe.name} only
            </button>
            <button
              type="button"
              onClick={() => setAudience("all")}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1.5 transition",
                audience === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Globe className="h-3 w-3" /> All Tribes
            </button>
          </div>
        )}

        <textarea
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder="Share a plan, an invite, a small thing…"
          className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        {imageUrl && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-border">
            <img src={imageUrl} alt="Attached preview" className="block max-h-72 w-full object-cover" />
            <button
              onClick={() => setImageUrl(null)}
              aria-label="Remove image"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-background"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? "Uploading…" : imageUrl ? "Replace" : "Gallery"}
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              aria-label="Take photo"
              className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
              Camera
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">{text.length}/280</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickFile}
          />
        </div>

        <button
          onClick={submit}
          disabled={!text.trim() && !imageUrl}
          className="mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          style={{ backgroundColor: effectiveAudience === "all" ? "var(--primary)" : tribe.colorVar }}
        >
          Send Signal
        </button>
      </div>
    </div>
  );
}
