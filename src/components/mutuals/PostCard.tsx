import { Heart, MessageCircle, Share2 } from "lucide-react";
import type { Post } from "@/lib/mutuals-data";
import { tribeById, personById } from "@/lib/mutuals-data";
import { PlusBadge } from "./PlusBadge";

export function PostCard({ post, showTribe = false }: { post: Post; showTribe?: boolean }) {
  const tribe = tribeById(post.tribeId);
  const author = personById(post.authorId);
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
        <button className="flex items-center gap-1.5 text-xs transition-colors hover:text-foreground">
          <Heart className="h-4 w-4" /> {post.likes}
        </button>
        <button className="flex items-center gap-1.5 text-xs transition-colors hover:text-foreground">
          <MessageCircle className="h-4 w-4" /> {post.replies}
        </button>
        <button className="ml-auto flex items-center gap-1.5 text-xs transition-colors hover:text-foreground">
          <Share2 className="h-4 w-4" />
        </button>
      </footer>
    </article>
  );
}
