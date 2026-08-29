import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Bookmark,
  ImagePlus,
} from "lucide-react";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useMySavedIds, useToggleSave } from "@/lib/posts-store";
import { Link } from "@tanstack/react-router";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { PlusBadge } from "./PlusBadge";
import { SafetyMenu } from "./SafetyMenu";
import { CommentsModal } from "./CommentsModal";
import { useSocial, useToggleLike, useMyShares, useToggleShare } from "@/lib/social-store";
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
        onClick={() => {
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
            <img
              src={src}
              alt={i === 0 ? alt : ""}
              draggable={false}
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

export function PostCard({ post, showTribe = false }: { post: FeedPost; showTribe?: boolean }) {
  const { user } = useAuth();
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

  const editPost = useEditPost();
  const deletePost = useDeletePost();

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    setMenuOpen(false);
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
      className="rounded-2xl border border-border bg-card p-4 transition-shadow"
      style={{ ["--tribe-active" as string]: tribe.colorVar }}
    >
      <header className="flex items-center gap-3">
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
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Post actions"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-40 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <button
                    onClick={startEdit}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit post
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDel(true);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete post
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <SafetyMenu
            targetName={author.name}
            targetUserId={post.author_id}
            targetPostId={post.id}
            kind="post"
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
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
        </>
      )}

      <footer className="mt-3 flex items-center gap-5 text-muted-foreground">
        <button
          onClick={() => {
            if (post.id.startsWith("tmp-")) return;
            toggleLike.mutate(post.id);
          }}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors",
            liked ? "text-rose-400" : "hover:text-foreground",
          )}
          aria-pressed={liked}
        >
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} /> {post.likes_count}
        </button>
        <button
          onClick={() => setCommentsOpen(true)}
          className="flex items-center gap-1.5 text-xs transition-colors hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" /> {post.replies_count}
        </button>
        <button
          onClick={() => {
            if (!post.id.startsWith("tmp-")) toggleSave.mutate(post.id);
          }}
          className={cn(
            "ml-auto flex items-center gap-1.5 text-xs transition-colors",
            saved ? "text-amber-400" : "hover:text-foreground",
          )}
          aria-label={saved ? "Unsave post" : "Save post"}
          aria-pressed={saved}
        >
          <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
        </button>
        <button
          onClick={share}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors",
            shared ? "text-primary" : "hover:text-foreground",
          )}
          aria-label="Share post"
          aria-pressed={shared}
        >
          <Share2 className="h-4 w-4" fill={shared ? "currentColor" : "none"} /> {post.shares_count}
        </button>
      </footer>

      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={post.id}
        isPostOwner={isMine}
      />

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
