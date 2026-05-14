import { useRef, useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { socialStore } from "@/lib/social-store";
import { toast } from "sonner";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function ComposerModal({
  open, onClose, tribeId,
}: { open: boolean; onClose: () => void; tribeId: TribeId }) {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;
  const tribe = tribeById(tribeId);

  const reset = () => { setText(""); setImageUrl(null); };

  const submit = () => {
    const t = text.trim();
    if (!t && !imageUrl) return;
    socialStore.addPost(tribeId, t || "", "me", imageUrl ?? undefined);
    reset();
    onClose();
    toast.success("Posted to " + tribe.name);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files are supported.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Image too large", { description: "Max 5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => toast.error("Couldn't read that image.");
    reader.readAsDataURL(f);
  };

  const close = () => { reset(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={close} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 animate-rise">
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <p className="label-mono text-muted-foreground">New post · {tribe.name}</p>
        <h2 className="font-display text-xl font-bold">What's happening?</h2>
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

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ImagePlus className="h-4 w-4" />
            {imageUrl ? "Replace photo" : "Add photo"}
          </button>
          <span className="text-[11px] text-muted-foreground">{text.length}/280</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
        </div>

        <button
          onClick={submit}
          disabled={!text.trim() && !imageUrl}
          className="mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          style={{ backgroundColor: tribe.colorVar }}
        >
          Post
        </button>
      </div>
    </div>
  );
}
