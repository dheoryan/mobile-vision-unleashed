import { useRef, useState } from "react";
import { X, ImagePlus, Camera, Loader2 } from "lucide-react";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { useCreatePost } from "@/lib/posts-store";
import { uploadPostImage } from "@/lib/uploads";
import { compressImage } from "@/lib/image-compress";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { requestPushPrompt } from "@/lib/push-prompt-events";
import { AnimatedModal } from "@/components/ui/animated-modal";
import {
  MentionSuggestions,
  useMentionPicker,
  useMentionRegistry,
  type MentionProfile,
} from "./MentionInput";
import { applyMention, collectMentionIds } from "@/lib/mentions";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB pre-compression cap

export type Audience = "tribe" | "all";

export function ComposerModal({
  open, onClose, tribeId, initialAudience = "tribe",
}: { open: boolean; onClose: () => void; tribeId: TribeId; initialAudience?: Audience }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [caret, setCaret] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const createPost = useCreatePost();
  const { register, registry } = useMentionRegistry();
  const mentionPicker = useMentionPicker(text, caret);

  const tribe = tribeById(tribeId);
  /**
   * Audience is a deliberate choice, not a consequence of navigation.
   *
   * This was previously fixed to whichever tab the user happened to be on when
   * they tapped compose — the composer showed a label, but there was no way to
   * change it and no reason for the user to realise it had been decided for
   * them. "Who sees this?" is the question every poster resolves before
   * posting; if the answer is set by invisible state, the rule can't be
   * learned and people hesitate.
   *
   * The tab still seeds the default, since it's a good guess at intent.
   */
  const [audience, setAudience] = useState<Audience>(initialAudience);
  const effectiveAudience: Audience = audience;

  const reset = () => {
    setText("");
    setCaret(0);
    setImagePath(null);
    setImagePreviewUrl(null);
    setAudience(initialAudience);
  };

  const pickMention = (profile: MentionProfile) => {
    if (!profile.handle || mentionPicker.start < 0) return;
    register(profile);
    const next = applyMention(text, caret, mentionPicker.start, profile.handle);
    setText(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = () => {
    const t = text.trim();
    if (!t && !imagePath) return;
    if (uploading) return;
    createPost.mutate(
      {
        tribe_id: tribeId,
        content: t,
        image_path: imagePath ?? null,
        image_preview_url: imagePreviewUrl ?? null,
        audience: effectiveAudience,
        mentions: collectMentionIds(t, registry),
      },
      {
        onError: (e) => toast.error((e as Error).message),
      },
    );
    toast.success(
      effectiveAudience === "all"
        ? "Posted to The Wild — everyone can see this"
        : `Posted to ${tribe.name} — members only`,
    );
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
      const path = await uploadPostImage(user.id, compressed);
      setImagePath(path);
      setImagePreviewUrl(URL.createObjectURL(compressed));
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const close = () => { reset(); onClose(); };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => { if (!o) close(); }}
      title={`New post — ${effectiveAudience === "all" ? "The Wild" : tribe.name}`}
      contentClassName="p-6"
    >
        <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <p className="label-mono text-muted-foreground">New post</p>
        <h2 className="font-display text-xl font-bold">What's happening?</h2>

        {/* Audience picker. Stated in terms of who can see it, not where it
            files — that is the question the user is actually asking. */}
        <div className="mt-4">
          <p className="label-mono text-muted-foreground">Who sees this?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <AudienceOption
              active={effectiveAudience === "tribe"}
              onClick={() => setAudience("tribe")}
              accent={tribe.colorVar}
              title={tribe.name}
              sub="Your Tribe only"
            />
            <AudienceOption
              active={effectiveAudience === "all"}
              onClick={() => setAudience("all")}
              accent="var(--primary)"
              title="The Wild"
              sub="Everyone on MEUTUALS"
            />
          </div>
        </div>

        <div className="relative mt-4">
          <MentionSuggestions suggestions={mentionPicker.suggestions} onPick={pickMention} />
          <textarea
            ref={textRef}
            autoFocus
            rows={4}
            value={text}
            onChange={(event) => {
              const next = event.target.value.slice(0, 280);
              setText(next);
              setCaret(Math.min(event.target.selectionStart ?? next.length, next.length));
            }}
            onClick={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
            onKeyUp={(event) =>
              setCaret(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
            }
            placeholder="Share a plan, invite someone with @, or post a small thing…"
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {imagePreviewUrl && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-border">
            <img src={imagePreviewUrl} alt="Attached preview" className="block max-h-72 w-full object-cover" />
            <button
              onClick={() => { setImagePath(null); setImagePreviewUrl(null); }}
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
              {uploading ? "Uploading…" : imagePath ? "Replace" : "Gallery"}
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
          disabled={!text.trim() && !imagePath}
          className="mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          style={{ backgroundColor: effectiveAudience === "all" ? "var(--primary)" : tribe.colorVar }}
        >
          Send Signal
        </button>
    </AnimatedModal>
  );
}

function AudienceOption({
  active, onClick, accent, title, sub,
}: {
  active: boolean;
  onClick: () => void;
  accent: string;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-2xl border p-3 text-left transition-colors"
      style={
        active
          ? { borderColor: accent, background: `color-mix(in oklab, ${accent} 14%, transparent)` }
          : { borderColor: "var(--border)" }
      }
    >
      <p className="truncate text-sm font-semibold">{title}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>
    </button>
  );
}
