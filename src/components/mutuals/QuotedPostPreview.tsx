import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { timeAgoLabel } from "@/lib/time";
import type { FeedPost } from "@/lib/posts-store";
import { LazyImage } from "./LazyImage";

/**
 * A quoted post embedded read-only inside another post (or the composer
 * while building a quote). Deliberately its own small component rather than
 * `<PostCard>` reused recursively - the embed has no like/comment/repost
 * buttons of its own and never needs a quote of its own quote (hydratePosts
 * only resolves one level deep).
 */
export function QuotedPostPreview({ post }: { post: FeedPost }) {
  const tribe = tribeById(post.tribe_id as TribeId);
  const name = post.author?.display_name?.trim() || "Someone";
  const avatar = post.author?.avatar_url || post.author?.avatar_emoji || "🙂";
  return (
    <div className="mt-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-sm"
          style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
        >
          {avatar.startsWith("data:") || avatar.startsWith("http") ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            avatar
          )}
        </span>
        <span className="truncate text-xs font-semibold">{name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {timeAgoLabel(post.created_at)}
        </span>
      </div>
      {post.content && (
        <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {post.content}
        </p>
      )}
      {post.images[0] && (
        <div className="relative mt-2">
          <LazyImage
            src={post.images[0]}
            alt=""
            wrapperClassName="max-h-56 w-full overflow-hidden rounded-lg"
            className="max-h-56 w-full rounded-lg object-cover"
          />
          {post.images.length > 1 && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
              +{post.images.length - 1} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function QuotedPostUnavailable() {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
      <ProhibitIcon className="h-3.5 w-3.5 shrink-0" />
      This post is no longer available.
    </div>
  );
}
