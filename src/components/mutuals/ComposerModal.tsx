import { useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { useCreatePost, type FeedPost } from "@/lib/posts-store";
import { QuotedPostPreview } from "./QuotedPostPreview";
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
import { ImageStrip, type ComposedImage } from "./ImageStrip";
import { cn } from "@/lib/utils";
import { useVisualViewport, visualViewportStyle } from "@/hooks/use-visual-viewport";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB pre-compression cap
const MAX_IMAGES = 10;

export type Audience = "tribe" | "all";

export function ComposerModal({
  open,
  onClose,
  tribeId,
  initialAudience = "tribe",
  quotedPost,
}: {
  open: boolean;
  onClose: () => void;
  tribeId: TribeId;
  initialAudience?: Audience;
  /** Quoting a Tribe-only post locks the quote to that same Tribe - it can
   *  never be re-broadcast wider than the post it quotes. Quoting an
   *  "everyone" post leaves the audience picker free, same as any post. */
  quotedPost?: FeedPost;
}) {
  const { user } = useAuth();
  const audienceLocked = quotedPost?.audience === "tribe";
  const effectiveTribeId = audienceLocked ? (quotedPost!.tribe_id as TribeId) : tribeId;
  const [text, setText] = useState("");
  const [images, setImages] = useState<ComposedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [caret, setCaret] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const createPost = useCreatePost();
  const { register, registry } = useMentionRegistry();
  const mentionPicker = useMentionPicker(text, caret);
  const visualViewport = useVisualViewport(open);

  const tribe = tribeById(effectiveTribeId);
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
  const [audience, setAudience] = useState<Audience>(audienceLocked ? "tribe" : initialAudience);
  const effectiveAudience: Audience = audienceLocked ? "tribe" : audience;

  // Revoking is only safe when the images are genuinely abandoned (the
  // draft is being discarded). The optimistic post created on submit keeps
  // rendering these exact blob: URLs until the real server response
  // replaces it - revoking them at that point (as `reset` used to,
  // unconditionally, right after every submit) killed the preview out from
  // under the still-showing optimistic post, leaving a blank/black image
  // area until the real signed URL eventually arrived.
  const reset = (options: { revokeImages?: boolean } = {}) => {
    setText("");
    setCaret(0);
    if (options.revokeImages) {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    }
    setImages([]);
    setAudience(audienceLocked ? "tribe" : initialAudience);
    setConfirmDiscard(false);
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
    if (!t && images.length === 0 && !quotedPost) return;
    if (uploading) return;
    createPost.mutate(
      {
        tribe_id: effectiveTribeId,
        content: t,
        image_paths: images.map((img) => img.path),
        image_preview_urls: images.map((img) => img.previewUrl),
        audience: effectiveAudience,
        mentions: collectMentionIds(t, registry),
        quoted_post_id: quotedPost?.id,
        quoted_post: quotedPost,
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

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_IMAGES} photos per post.`);
      return;
    }
    const toUpload = files.slice(0, room);
    if (files.length > room) {
      toast(`Only added ${room} of ${files.length} — ${MAX_IMAGES} photos per post max.`);
    }
    for (const f of toUpload) {
      if (!f.type.startsWith("image/")) {
        toast.error("Only image files.");
        return;
      }
      if (f.size > MAX_BYTES) {
        toast.error("Image too large", { description: "Max 15 MB per photo." });
        return;
      }
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        toUpload.map(async (f) => {
          const compressed = await compressImage(f, { maxDimension: 2048, quality: 0.85 });
          const path = await uploadPostImage(user.id, compressed);
          return { path, previewUrl: URL.createObjectURL(compressed) };
        }),
      );
      setImages((cur) => [...cur, ...uploaded]);
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((cur) => {
      const removed = cur[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return cur.filter((_, i) => i !== index);
    });
  };

  const hasDraft = text.trim().length > 0 || images.length > 0;

  // Closing used to discard whatever was typed with no warning - a stray
  // tap on the backdrop or the X threw away a half-written post outright.
  // Only interrupt the close when there's actually something to lose.
  const close = () => {
    if (hasDraft && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    reset({ revokeImages: true });
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title={
        quotedPost
          ? "Quote post"
          : `New post — ${effectiveAudience === "all" ? "The Wild" : tribe.name}`
      }
      contentClassName="max-h-[85dvh] overflow-y-auto scroll-panel p-6"
      viewportStyle={visualViewportStyle(visualViewport)}
    >
      <button
        onClick={close}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <XIcon className="h-5 w-5" />
      </button>

      {confirmDiscard ? (
        <div className="relative">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <WarningIcon className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold leading-tight">Discard this post?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            What you've written so far will be lost.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => {
                reset({ revokeImages: true });
                onClose();
              }}
              className="w-full rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              Discard post
            </button>
            <button
              onClick={() => setConfirmDiscard(false)}
              className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Keep editing
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="font-display text-lg font-bold">What's the signal?</h2>

          {/* Audience picker. Stated in terms of who can see it, not where it
            files — that is the question the user is actually asking. A
            segmented pill instead of two bordered cards: same explicit
            choice, same two options, just not a third of the sheet before
            you've typed a word. */}
          {audienceLocked ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Quoting a {tribe.name}-only post keeps this quote inside {tribe.name} too.
            </p>
          ) : (
            <div className="mt-4">
              <p className="label-mono text-muted-foreground">Who sees this?</p>
              <div className="mt-2 flex gap-[3px] rounded-full bg-secondary p-[3px]">
                <AudienceSegment
                  active={effectiveAudience === "tribe"}
                  onClick={() => setAudience("tribe")}
                  accent={tribe.colorVar}
                  label={tribe.name}
                />
                <AudienceSegment
                  active={effectiveAudience === "all"}
                  onClick={() => setAudience("all")}
                  accent="var(--brand-solid)"
                  brandGradient
                  label="The Wild"
                />
              </div>
            </div>
          )}

          <div className="relative mt-4">
            <MentionSuggestions suggestions={mentionPicker.suggestions} onPick={pickMention} />
            <textarea
              ref={textRef}
              autoFocus
              rows={4}
              value={text}
              onChange={(event) => {
                const next = event.target.value.slice(0, 500);
                setText(next);
                setCaret(Math.min(event.target.selectionStart ?? next.length, next.length));
              }}
              onClick={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
              onKeyUp={(event) =>
                setCaret(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
              }
              placeholder="Say the thing."
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {images.length > 0 && (
            <ImageStrip
              images={images}
              onReorder={setImages}
              onRemove={removeImage}
              onAddMore={() => fileRef.current?.click()}
              canAddMore={images.length < MAX_IMAGES}
              uploading={uploading}
            />
          )}

          {quotedPost && <QuotedPostPreview post={quotedPost} />}

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || images.length >= MAX_IMAGES}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                {uploading ? (
                  <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {uploading
                  ? "Uploading…"
                  : images.length > 0
                    ? `Add more (${images.length}/${MAX_IMAGES})`
                    : "Gallery"}
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={uploading || images.length >= MAX_IMAGES}
                aria-label="Take photo"
                className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                <CameraIcon className="h-4 w-4" />
                Camera
              </button>
            </div>
            <span className="text-[11px] text-muted-foreground">{text.length}/500</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onPickFiles}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickFiles}
            />
          </div>

          <button
            onClick={submit}
            disabled={!text.trim() && images.length === 0 && !quotedPost}
            className={cn(
              "mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40",
              effectiveAudience === "all" && "bg-meutuals-gradient text-white",
            )}
            style={effectiveAudience === "tribe" ? { backgroundColor: tribe.colorVar } : undefined}
          >
            {quotedPost ? "Quote" : "Send Signal"}
          </button>
        </>
      )}
    </AnimatedModal>
  );
}

function AudienceSegment({
  active,
  onClick,
  accent,
  brandGradient = false,
  label,
}: {
  active: boolean;
  onClick: () => void;
  accent: string;
  brandGradient?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-9 flex-1 truncate rounded-full text-sm font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
        active && brandGradient && "bg-meutuals-gradient text-white",
      )}
      style={active && !brandGradient ? { backgroundColor: accent } : undefined}
    >
      {label}
    </button>
  );
}
