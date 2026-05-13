import { useState } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import type { Post } from "@/lib/mutuals-data";
import { tribeById, personById } from "@/lib/mutuals-data";
import { PlusBadge } from "./PlusBadge";
import { SafetyMenu } from "./SafetyMenu";
import { CommentsModal } from "./CommentsModal";
import { useSocial, socialStore } from "@/lib/social-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PostCard({ post: seed, showTribe = false }: { post: Post; showTribe?: boolean }) {
  const social = useSocial();
  const post = social.posts.find((p) => p.id === seed.id) ?? seed;
  const tribe = tribeById(post.tribeId);
  const author = post.authorId === "me"
    ? { name: "You", handle: "@you", avatar: "🙂", plus: false }
    : personById(post.authorId);
  const liked = social.liked.has(post.id);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const share = async () => {
    try {
      await navigator.clipboard?.writeText(`https://mutuals.app/p/${post.id}`);
      toast.success("Link copied");
    } catch {
      toast.success("Shared");
    }
  };

  return (
    <article
      className="rounded-2xl border border-border bg-card p-4 animate-rise"
      style={{ ["--tribe-active" as string]: tribe.colorVar }}
    >
      <header className="flex items-center gap-3">
        <span className="relative">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
          >
            {author.avatar}
          </span>
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
        <SafetyMenu targetName={author.name} kind="post" />
      </header>

      <p className="mt-3 font-sans text-[15px] leading-relaxed text-foreground">{post.content}</p>

      {post.image && (
        <div
          className="mt-3 flex h-40 items-center justify-center rounded-xl text-5xl"
          style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 30%, var(--card)) 0%, var(--card) 100%)` }}
        >
          {post.image}
        </div>
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
    </article>
  );
}
