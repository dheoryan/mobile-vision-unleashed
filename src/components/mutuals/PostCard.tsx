import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { QuotesIcon } from "@phosphor-icons/react/dist/csr/Quotes";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { RepeatIcon } from "@phosphor-icons/react/dist/csr/Repeat";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useMySavedIds, useToggleSave } from "@/lib/posts-store";
import { Link, useNavigate } from "@tanstack/react-router";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { PlusBadge } from "./PlusBadge";
import { SafetyMenu } from "./SafetyMenu";
import { PostOwnMenu } from "./PostOwnMenu";
import { ComposerModal } from "./ComposerModal";
import { QuotedPostPreview, QuotedPostUnavailable } from "./QuotedPostPreview";
import { QuotedCommentPreview, QuotedCommentUnavailable } from "./QuotedCommentPreview";
import {
  useSocial,
  useToggleLike,
  useMyShares,
  useToggleShare,
  useMyReposts,
  useToggleRepost,
} from "@/lib/social-store";
import { useDeletePost, useEditPost, type FeedPost } from "@/lib/posts-store";
import { useAuth } from "@/lib/auth-context";
import { uploadPostImage } from "@/lib/uploads";
import { compressImage } from "@/lib/image-compress";
import { timeAgoLabel } from "@/lib/time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { showPlusBadge } from "@/lib/feature-flags";
import { splitPostMentions } from "@/lib/post-mentions";
import { PostMediaLightbox } from "./PostMediaLightbox";
import { ImageStrip, type ComposedImage } from "./ImageStrip";
import { LazyImage } from "./LazyImage";
import { RepostAudienceChoices, type RepostAudience } from "./RepostAudienceChoices";
import { SharePostSheet } from "./SharePostSheet";
import { useMyProfile } from "@/lib/profile-store";

const MAX_IMG_BYTES = 15 * 1024 * 1024;
const MAX_IMAGES = 10;

/** The feed-card version of the carousel: swipe to page, dot indicator,
 *  tap opens the full-screen lightbox at whichever photo is centered. No
 *  zoom here - that's the lightbox's job once you've committed to looking
 *  closer. */
function PostImageCarousel({
  images,
  alt,
  onOpen,
}: {
  images: string[];
  alt: string;
  onOpen: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const moved = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startX.current = event.clientX;
    setDragging(true);
    moved.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = event.clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    const atStart = index === 0 && dx > 0;
    const atEnd = index === images.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx * 0.35 : dx);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    const width = containerRef.current?.clientWidth || 1;
    if (Math.abs(dragX) > Math.min(60, width * 0.2)) {
      if (dragX < 0 && index < images.length - 1) setIndex((i) => i + 1);
      else if (dragX > 0 && index > 0) setIndex((i) => i - 1);
    }
    setDragX(0);
  };

  return (
    <div
      ref={containerRef}
      className="relative mt-3 overflow-hidden rounded-xl border border-border bg-black"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(event) => {
          event.stopPropagation();
          if (!moved.current) onOpen(index);
        }}
        className="flex touch-pan-y"
        style={{
          // The track itself is `images.length * 100%` wide, so a percentage
          // transform on it resolves against that full width, not one
          // slide's width - `-100%` would jump two slides on a 2-photo
          // post. Scale the per-index step down to one slide's share of the
          // track (100 / images.length) so each index moves exactly one
          // slide. The drag term stays in raw px, which is basis-independent.
          transform: `translate3d(calc(${(-index * 100) / images.length}% + ${dragX}px), 0, 0)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
          width: `${images.length * 100}%`,
        }}
      >
        {images.map((src, i) => (
          <div key={src} className="shrink-0" style={{ width: `${100 / images.length}%` }}>
            <LazyImage
              src={src}
              alt={i === 0 ? alt : ""}
              draggable={false}
              wrapperClassName="min-h-48 max-h-96 w-full"
              className="block h-auto max-h-96 w-full select-none object-cover"
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white">
            {index + 1}/{images.length}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((src, i) => (
              <span
                key={src}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ value, tribeColor }: { value: string; tribeColor: string }) {
  const isImg = value.startsWith("data:") || value.startsWith("http");
  return (
    <span
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-lg"
      style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 28%, transparent)` }}
    >
      {isImg ? <img src={value} alt="" className="h-full w-full object-cover" /> : value}
    </span>
  );
}

export function PostCard({
  post,
  showTribe = false,
  commentsInline = false,
}: {
  post: FeedPost;
  showTribe?: boolean;
  commentsInline?: boolean;
}) {
  const { user } = useAuth();
  const myProfile = useMyProfile();
  const navigate = useNavigate();
  const social = useSocial();
  const toggleLike = useToggleLike();
  const tribe = tribeById(post.tribe_id as TribeId);
  const isMine = !!user && post.author_id === user.id;
  const author = {
    name: post.author?.display_name?.trim() || (isMine ? "You" : "Someone"),
    handle: post.author?.handle ? `@${post.author.handle}` : isMine ? "@you" : "",
    avatar: post.author?.avatar_url || post.author?.avatar_emoji || "🙂",
    plus: showPlusBadge(post.author?.plan),
  };
  const liked = social.liked.has(post.id);
  const sharesQuery = useMyShares();
  const shared = sharesQuery.data?.has(post.id) ?? false;
  const toggleShare = useToggleShare();
  const savedIdsQuery = useMySavedIds();
  const saved = savedIdsQuery.data?.has(post.id) ?? false;
  const toggleSave = useToggleSave();
  const repostsQuery = useMyReposts();
  const reposted = repostsQuery.data?.has(post.id) ?? false;
  const toggleRepost = useToggleRepost();
  const myTribeId = myProfile?.tribeIds[0] ?? (post.tribe_id as TribeId);

  const editPost = useEditPost();
  const deletePost = useDeletePost();

  const [repostMenuOpen, setRepostMenuOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [editImages, setEditImages] = useState<ComposedImage[]>(() =>
    post.image_paths.map((path, i) => ({ path, previewUrl: post.images[i] ?? "" })),
  );
  const [confirmDel, setConfirmDel] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const changeRepost = (audience: RepostAudience) => {
    setRepostMenuOpen(false);
    toggleRepost.mutate(
      { postId: post.id, audience },
      {
        onSuccess: (result) =>
          toast.success(
            result.reposted
              ? audience === "tribe"
                ? `Reposted to ${tribeById(myTribeId).name}`
                : "Reposted to The Wild"
              : "Repost removed",
          ),
        onError: (error) =>
          toast.error(reposted ? "Repost wasn't removed" : "Post wasn't reposted", {
            description: (error as Error).message,
          }),
      },
    );
  };

  const share = async () => {
    if (post.id.startsWith("tmp-")) return;
    const url = `${window.location.origin}/p/${post.id}`;

    // Prefer the OS share sheet - a copied link is the fallback, not the
    // default, since it's the more effortful of the two for the person
    // sharing and a weaker distribution channel for the app.
    if (navigator.share) {
      try {
        await navigator.share({ url });
        toggleShare.mutate(post.id);
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // picker dismissed, not a share
        // any other failure falls through to the clipboard path below
      }
    }

    toggleShare.mutate(post.id);
    try {
      await navigator.clipboard?.writeText(url);
      toast.success(shared ? "Unshared" : "Link copied");
    } catch {
      toast.success(shared ? "Unshared" : "Shared");
    }
  };

  const startEdit = () => {
    setEditText(post.content);
    setEditImages(post.image_paths.map((path, i) => ({ path, previewUrl: post.images[i] ?? "" })));
    setEditing(true);
  };

  const saveEdit = () => {
    const t = editText.trim();
    if (!t && editImages.length === 0) {
      toast.error("Post can't be empty.");
      return;
    }
    const currentPaths = editImages.map((img) => img.path);
    const original = post.image_paths;
    const imagesChanged =
      currentPaths.length !== original.length || currentPaths.some((p, i) => p !== original[i]);
    editPost.mutate(
      { id: post.id, content: t, ...(imagesChanged ? { image_paths: currentPaths } : {}) },
      {
        onSuccess: () => toast.success("Post updated"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
    setEditing(false);
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !user) return;

    const room = MAX_IMAGES - editImages.length;
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
      if (f.size > MAX_IMG_BYTES) {
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
      setEditImages((cur) => [...cur, ...uploaded]);
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const removeEditImage = (index: number) => {
    setEditImages((cur) => cur.filter((_, i) => i !== index));
  };

  return (
    <article
      data-post-id={post.id}
      onClick={() => {
        // Already on this post's own page, mid-edit, or an optimistic row
        // that has no real id yet - nothing to navigate to in any of those.
        if (commentsInline || editing || post.id.startsWith("tmp-")) return;
        void navigate({ to: "/p/$postId", params: { postId: post.id }, search: { from: "feed" } });
      }}
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        !commentsInline && !editing && "cursor-pointer",
      )}
      style={{ ["--tribe-active" as string]: tribe.colorVar }}
    >
      {post.reposted_by && (
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <RepeatIcon className="h-3.5 w-3.5" weight="bold" />
          Reposted by {post.reposted_by.display_name?.trim() || "Someone"}
        </p>
      )}
      <header className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
        {isMine ? (
          <span className="relative">
            <Avatar value={author.avatar} tribeColor={tribe.colorVar} />
            {author.plus && <PlusBadge />}
          </span>
        ) : (
          <Link
            to="/u/$handle"
            params={{ handle: post.author?.handle || post.author_id }}
            className="relative shrink-0"
          >
            <Avatar value={author.avatar} tribeColor={tribe.colorVar} />
            {author.plus && <PlusBadge />}
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isMine ? (
              <p className="truncate text-sm font-semibold">{author.name}</p>
            ) : (
              <Link
                to="/u/$handle"
                params={{ handle: post.author?.handle || post.author_id }}
                className="truncate text-sm font-semibold hover:underline"
              >
                {author.name}
              </Link>
            )}
            {author.handle && (
              <span className="text-xs text-muted-foreground">{author.handle}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {showTribe && (
              <span style={{ color: `color-mix(in oklab, ${tribe.colorVar} 70%, white)` }}>
                {tribe.name}
              </span>
            )}
            {showTribe && " · "}
            {timeAgoLabel(post.created_at)}
          </p>
        </div>
        {post.tag && (
          <span
            className="label-mono rounded-full px-2 py-1"
            style={{
              color: tribe.colorVar,
              backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 16%, transparent)`,
            }}
          >
            {post.tag}
          </span>
        )}
        {isMine ? (
          <PostOwnMenu
            onEdit={startEdit}
            saved={saved}
            onToggleSave={() => {
              if (!post.id.startsWith("tmp-")) toggleSave.mutate(post.id);
            }}
            onDelete={() => setConfirmDel(true)}
          />
        ) : (
          <SafetyMenu
            targetName={author.name}
            targetUserId={post.author_id}
            targetPostId={post.id}
            kind="post"
            saved={saved}
            onToggleSave={() => {
              if (!post.id.startsWith("tmp-")) toggleSave.mutate(post.id);
            }}
          />
        )}
      </header>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            autoFocus
            rows={3}
            value={editText}
            onChange={(e) => setEditText(e.target.value.slice(0, 500))}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          {editImages.length > 0 && (
            <ImageStrip
              images={editImages}
              onReorder={setEditImages}
              onRemove={removeEditImage}
              onAddMore={() => fileRef.current?.click()}
              canAddMore={editImages.length < MAX_IMAGES}
              uploading={uploading}
            />
          )}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || editImages.length >= MAX_IMAGES}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {uploading ? (
                <SpinnerGapIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
              {uploading
                ? "Uploading…"
                : editImages.length > 0
                  ? `Add more (${editImages.length}/${MAX_IMAGES})`
                  : "Add photo"}
            </button>
            <span className="text-[10px] text-muted-foreground">{editText.length}/500</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onPickFiles}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.content && (
            <p className="mt-3 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground">
              {splitPostMentions(post.content).map((segment, index) =>
                segment.handle ? (
                  <Link
                    key={`${segment.text}-${index}`}
                    to="/u/$handle"
                    params={{ handle: segment.handle }}
                    className="rounded-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {segment.text}
                  </Link>
                ) : (
                  <span key={`${segment.text}-${index}`}>{segment.text}</span>
                ),
              )}
            </p>
          )}

          {post.images.length > 0 && (
            <PostImageCarousel
              images={post.images}
              alt={`${author.name}'s post`}
              onOpen={(index) => {
                setMediaIndex(index);
                setMediaOpen(true);
              }}
            />
          )}

          {post.quoted_post_id &&
            (post.quoted_post ? (
              <QuotedPostPreview post={post.quoted_post} />
            ) : (
              <QuotedPostUnavailable />
            ))}
          {post.quoted_comment_id &&
            (post.quoted_comment ? (
              <QuotedCommentPreview comment={post.quoted_comment} />
            ) : (
              <QuotedCommentUnavailable />
            ))}
        </>
      )}

      <footer
        className="mt-3 flex items-center gap-5 text-muted-foreground"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={() => {
            if (post.id.startsWith("tmp-")) return;
            toggleLike.mutate(post.id);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md text-xs transition-colors active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            liked ? "text-rose-400" : "hover:text-rose-400",
          )}
          aria-pressed={liked}
        >
          <HeartIcon className="h-4 w-4" weight={liked ? "fill" : "regular"} /> {post.likes_count}
        </button>
        <button
          onClick={() => {
            if (commentsInline) {
              document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" });
              return;
            }
            void navigate({
              to: "/p/$postId",
              params: { postId: post.id },
              search: { from: "feed" },
            });
          }}
          aria-label={`${post.replies_count} comments`}
          className="flex items-center gap-1.5 rounded-md text-xs transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChatCircleIcon className="h-4 w-4" weight="regular" /> {post.replies_count}
        </button>
        <div className="ml-auto">
          <button
            onClick={() => {
              if (post.id.startsWith("tmp-")) return;
              setRepostMenuOpen(true);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md text-xs transition-colors active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              reposted ? "text-emerald-400" : "hover:text-emerald-400",
            )}
            aria-label="Repost options"
            aria-pressed={reposted}
          >
            <RepeatIcon className="h-4 w-4" weight={reposted ? "fill" : "regular"} />{" "}
            {post.reposts_count}
          </button>
        </div>
        <button
          onClick={() => {
            if (post.id.startsWith("tmp-")) return;
            setShareSheetOpen(true);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md text-xs transition-colors active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            shared ? "text-primary" : "hover:text-primary",
          )}
          aria-label="Share post"
          aria-pressed={shared}
        >
          <PaperPlaneTiltIcon className="h-4 w-4" weight={shared ? "fill" : "regular"} />{" "}
          {post.shares_count}
        </button>
      </footer>

      <SharePostSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        postId={post.id}
        onExternalShare={share}
      />

      <AnimatedModal
        open={repostMenuOpen}
        onOpenChange={setRepostMenuOpen}
        title="Repost options"
        contentClassName="overflow-hidden"
      >
        <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/35" />
          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <div>
              <p className="label-mono text-primary">PASS IT ON</p>
              <h2 className="mt-0.5 font-display text-xl font-bold">Repost signal</h2>
            </div>
            <button
              type="button"
              onClick={() => setRepostMenuOpen(false)}
              aria-label="Close repost options"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="border-y border-border">
            <button
              type="button"
              onClick={() => {
                setRepostMenuOpen(false);
                setQuoteOpen(true);
              }}
              className="group flex min-h-[4.75rem] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <QuotesIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Quote signal</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Add your own words before sharing
                </span>
              </span>
              <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            {reposted && (
              <button
                type="button"
                disabled={toggleRepost.isPending}
                onClick={() => changeRepost("tribe")}
                className="group flex min-h-[4.75rem] w-full items-center gap-3 border-t border-border px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-400">
                  <RepeatIcon className="h-5 w-5" weight="fill" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Undo repost</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Remove it from your reposts
                  </span>
                </span>
                <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>

          {!reposted && (
            <RepostAudienceChoices
              tribeId={myTribeId}
              allowWild={post.audience === "all"}
              disabled={toggleRepost.isPending}
              onSelect={changeRepost}
            />
          )}
        </div>
      </AnimatedModal>

      {quoteOpen && (
        <ComposerModal
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          tribeId={post.tribe_id as TribeId}
          initialAudience={post.audience}
          quotedPost={post}
        />
      )}

      {post.images.length > 0 && (
        <PostMediaLightbox
          open={mediaOpen}
          onClose={() => setMediaOpen(false)}
          images={post.images}
          initialIndex={mediaIndex}
          alt={`${author.name}'s post photo`}
        />
      )}

      <AnimatedModal
        open={confirmDel}
        onOpenChange={(o) => {
          if (!o) setConfirmDel(false);
        }}
        title="Delete this post?"
        center
        contentClassName="mx-4 max-w-sm p-5"
      >
        <h3 className="font-display text-base font-bold">Delete this post?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This can't be undone. Comments and likes will be removed.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setConfirmDel(false)}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setConfirmDel(false);
              deletePost.mutate(
                { id: post.id },
                {
                  onSuccess: () => toast.success("Post deleted"),
                  onError: (e) => toast.error((e as Error).message),
                },
              );
            }}
            className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground"
          >
            Delete
          </button>
        </div>
      </AnimatedModal>
    </article>
  );
}
