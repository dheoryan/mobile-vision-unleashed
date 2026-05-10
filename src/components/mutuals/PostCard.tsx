import { Heart, MessageCircle, Share2 } from "lucide-react";
import type { Post } from "@/lib/mutuals-data";
import { tribeById } from "@/lib/mutuals-data";

export function PostCard({ post, showTribe = false }: { post: Post; showTribe?: boolean }) {
  const tribe = tribeById(post.tribeId);
  return (
    <article
      className="rounded-3xl border border-border bg-card p-4"
      style={{ ["--tribe-active" as string]: tribe.colorVar }}
    >
      <header className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 25%, transparent)` }}
        >
          {post.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{post.author}</p>
            <span className="text-xs text-muted-foreground">{post.handle}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {showTribe && (
              <span style={{ color: `color-mix(in oklab, ${tribe.colorVar} 80%, white)` }}>
                {tribe.name}
              </span>
            )}
            {showTribe && " · "}
            {post.time} ago
          </p>
        </div>
        {post.tag && (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              color: tribe.colorVar,
              backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 18%, transparent)`,
            }}
          >
            {post.tag}
          </span>
        )}
      </header>

      <p className="mt-3 text-[15px] leading-relaxed text-foreground">{post.content}</p>

      <footer className="mt-4 flex items-center gap-5 text-muted-foreground">
        <button className="flex items-center gap-1.5 text-xs hover:text-foreground">
          <Heart className="h-4 w-4" /> {post.likes}
        </button>
        <button className="flex items-center gap-1.5 text-xs hover:text-foreground">
          <MessageCircle className="h-4 w-4" /> {post.replies}
        </button>
        <button className="ml-auto flex items-center gap-1.5 text-xs hover:text-foreground">
          <Share2 className="h-4 w-4" />
        </button>
      </footer>
    </article>
  );
}
