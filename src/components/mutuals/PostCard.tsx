import { useRef, useState } from "react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Pencil, Trash2, ImagePlus, X } from "lucide-react";
import type { Post } from "@/lib/mutuals-data";
import { tribeById, personById } from "@/lib/mutuals-data";
import { PlusBadge } from "./PlusBadge";
import { SafetyMenu } from "./SafetyMenu";
import { CommentsModal } from "./CommentsModal";
import { useSocial, socialStore } from "@/lib/social-store";
import { useMyProfile } from "@/lib/profile-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export function PostCard({ post: seed, showTribe = false }: { post: Post; showTribe?: boolean }) {
  const social = useSocial();
  const me = useMyProfile();
  const post = social.posts.find((p) => p.id === seed.id) ?? seed;
  const tribe = tribeById(post.tribeId);
  const isMine = post.authorId === "me";
  const author = isMine
    ? { name: me?.name?.trim() || "You", handle: "@you", avatar: me?.avatar ?? "🙂", plus: me?.plan === "plus" }
    : personById(post.authorId);
  const liked = social.liked.has(post.id);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [editImage, setEditImage] = useState<string | null>(post.imageUrl ?? null);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const share = async () => {
    try {
      await navigator.clipboard?.writeText(`https://mutuals.app/p/${post.id}`);
      toast.success("Link copied");
    } catch {
      toast.success("Shared");
    }
  };

  const startEdit = () => {
    setMenuOpen(false);
    setEditText(post.content);
    setEditImage(post.imageUrl ?? null);
    setEditing(true);
  };

  const saveEdit = () => {
    const t = editText.trim();
    if (!t && !editImage) {
      toast.error("Post can't be empty.");
      return;
    }
    socialStore.editPost(post.id, t, editImage === post.imageUrl ? undefined : (editImage ?? null));
    setEditing(false);
    toast.success("Post updated");
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Only image files."); return; }
    if (f.size > MAX_IMG_BYTES) { toast.error("Image too large", { description: "Max 5 MB." }); return; }
    const r = new FileReader();
    r.onload = () => setEditImage(typeof r.result === "string" ? r.result : null);
    r.readAsDataURL(f);
  };

  return (
    <article
      className="rounded-2xl border border-border bg-card p-4 animate-rise"
      style={{ ["--tribe-active" as string]: tribe.colorVar }}
    >
      <header className="flex items-center gap-3">
        <span className="relative">
          <Avatar value={author.avatar} tribeColor={tribe.colorVar} />
          {author.plus && <PlusBadge />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{author.name}</p>
            <span className="text-xs text-muted-foreground">{author.handle}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {showTribe && (
              <span style={{ color: `color-mix(in oklab, ${tribe.colorVar} 70%, white)` }}>
                {tribe.name}
              </span>
            )}
            {showTribe && " · "}
            {post.time} ago
          </p>
        </div>
        {post.tag && (
          <span
            className="label-mono rounded-full px-2 py-1"
            style={{ color: tribe.colorVar, backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 16%, transparent)` }}
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
                  <button onClick={startEdit} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary">
                    <Pencil className="h-3.5 w-3.5" /> Edit post
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete post
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <SafetyMenu targetName={author.name} targetUserId={post.authorId} kind="post" />
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
          {editImage && (
            <div className="relative overflow-hidden rounded-xl border border-border">
              <img src={editImage} alt="" className="block max-h-72 w-full object-cover" />
              <button
                onClick={() => setEditImage(null)}
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
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {editImage ? "Replace" : "Add photo"}
            </button>
            <span className="text-[10px] text-muted-foreground">{editText.length}/280</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
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
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-foreground">{post.content}</p>
          )}

          {post.imageUrl ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <img src={post.imageUrl} alt="" className="block h-auto max-h-96 w-full object-cover" />
            </div>
          ) : post.image && (
            <div
              className="mt-3 flex h-40 items-center justify-center rounded-xl text-5xl"
              style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 30%, var(--card)) 0%, var(--card) 100%)` }}
            >
              {post.image}
            </div>
          )}
        </>
      )}

      <footer className="mt-3 flex items-center gap-5 text-muted-foreground">
        <button
          onClick={() => socialStore.toggleLike(post.id)}
          className={cn(
            "flex items-center gap-1.5 text-xs transition-colors",
            liked ? "text-rose-400" : "hover:text-foreground"
          )}
          aria-pressed={liked}
        >
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} /> {post.likes}
        </button>
        <button
          onClick={() => setCommentsOpen(true)}
          className="flex items-center gap-1.5 text-xs transition-colors hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" /> {post.replies}
        </button>
        <button
          onClick={share}
          className="ml-auto flex items-center gap-1.5 text-xs transition-colors hover:text-foreground"
          aria-label="Share post"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </footer>

      <CommentsModal open={commentsOpen} onClose={() => setCommentsOpen(false)} postId={post.id} />

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setConfirmDel(false)} />
          <div className="relative mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-5 animate-rise">
            <h3 className="font-display text-base font-bold">Delete this post?</h3>
            <p className="mt-1 text-xs text-muted-foreground">This can't be undone. Comments and likes will be removed.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDel(false)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => { socialStore.deletePost(post.id); setConfirmDel(false); toast.success("Post deleted"); }}
                className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
