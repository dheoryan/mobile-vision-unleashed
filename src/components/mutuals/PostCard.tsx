import { useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  Loader2,
  Bookmark,
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
import { timeAgoLabel } from "@/lib/time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { showPlusBadge } from "@/lib/feature-flags";
import { splitPostMentions } from "@/lib/post-mentions";
import { PostMediaLightbox } from "./PostMediaLightbox";

const MAX_IMG_BYTES = 5 * 1024 * 1024;

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
  const [editImagePath, setEditImagePath] = useState<string | null>(post.image_path);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(post.image_url);
  const [confirmDel, setConfirmDel] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const share = async () => {
    if (post.id.startsWith("tmp-")) return;
    toggleShare.mutate(post.id);
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}/p/${post.id}`);
      toast.success(shared ? "Unshared" : "Link copied");
    } catch {
      toast.success(shared ? "Unshared" : "Shared");
    }
  };

  const startEdit = () => {
    setMenuOpen(false);
    setEditText(post.content);
    setEditImagePath(post.image_path);
    setEditImageUrl(post.image_url);
    setEditing(true);
  };

  const saveEdit = () => {
    const t = editText.trim();
    if (!t && !editImagePath) {
      toast.error("Post can't be empty.");
      return;
    }
    const imageChanged = editImagePath !== post.image_path;
    editPost.mutate(
      { id: post.id, content: t, ...(imageChanged ? { image_path: editImagePath } : {}) },
      {
        onSuccess: () => toast.success("Post updated"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
    setEditing(false);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Only image files.");
      return;
    }
    if (f.size > MAX_IMG_BYTES) {
      toast.error("Image too large", { description: "Max 5 MB." });
      return;
    }
    setUploading(true);
    try {
      const path = await uploadPostImage(user.id, f);
      setEditImagePath(path);
      setEditImageUrl(URL.createObjectURL(f));
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
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
            onChange={(e) => setEditText(e.target.value.slice(0, 280))}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          {editImageUrl && (
            <div className="relative overflow-hidden rounded-xl border border-border">
              <img src={editImageUrl} alt="" className="block max-h-72 w-full object-cover" />
              <button
                onClick={() => {
                  setEditImagePath(null);
                  setEditImageUrl(null);
                }}
                aria-label="Remove image"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : editImagePath ? "Replace" : "Add photo"}
            </button>
            <span className="text-[10px] text-muted-foreground">{editText.length}/280</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
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

          {post.image_url && (
            <button
              type="button"
              onClick={() => setMediaOpen(true)}
              className="group mt-3 block w-full overflow-hidden rounded-xl border border-border bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Open ${author.name}'s photo full screen`}
            >
              <img
                src={post.image_url}
                alt={`${author.name}'s post`}
                className="block h-auto max-h-96 w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
              />
            </button>
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

      <CommentsModal open={commentsOpen} onClose={() => setCommentsOpen(false)} postId={post.id} />

      {post.image_url && (
        <PostMediaLightbox
          open={mediaOpen}
          onClose={() => setMediaOpen(false)}
          src={post.image_url}
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
