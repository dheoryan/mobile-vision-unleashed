import { useNavigate } from "@tanstack/react-router";
import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { timeAgoLabel } from "@/lib/time";
import type { FeedPost } from "@/lib/posts-store";
import { LazyImage } from "./LazyImage";

/** A post shared into a DM or Tribe chat. Purpose-built for the chat
 *  context rather than reusing `QuotedPostPreview` (that one's `border
 *  border-border` box is designed to separate itself from a plain post
 *  body - stacked on top of a coloured, already-bordered chat bubble it
 *  read as a box nested inside a mismatched box). This instead floats a
 *  flat `bg-background` card inside the bubble, same idea as how
 *  WhatsApp/Telegram render a forwarded post: one clean surface that reads
 *  the same whether the bubble behind it is coloured or plain. */
export function SharedPostCard({
  post,
  deleted = false,
}: {
  post: FeedPost | null;
  deleted?: boolean;
}) {
  const navigate = useNavigate();
  if (deleted || !post) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-background/90 px-3 py-2.5 text-xs text-muted-foreground">
        <ProhibitIcon className="h-3.5 w-3.5 shrink-0" />
        {deleted ? "This post has been deleted." : "This post is no longer available."}
      </div>
    );
  }

  const tribe = tribeById(post.tribe_id as TribeId);
  const name = post.author?.display_name?.trim() || "Someone";
  const avatar = post.author?.avatar_url || post.author?.avatar_emoji || "🙂";
  const isImageAvatar = avatar.startsWith("data:") || avatar.startsWith("http");

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        // "chat" tells the post page there's a real prior screen (this
        // conversation) sitting in history - without it, the post page
        // treated this exactly like a bare shared link and inserted a
        // synthetic Home entry between the chat and the post, so tapping
        // back landed on Home instead of returning to the conversation.
        void navigate({ to: "/p/$postId", params: { postId: post.id }, search: { from: "chat" } });
      }}
      className="block w-full overflow-hidden rounded-xl bg-background text-left text-foreground shadow-sm transition-opacity active:opacity-80"
    >
      {post.images[0] && (
        <div className="relative">
          <LazyImage
            src={post.images[0]}
            alt=""
            wrapperClassName="aspect-[16/11] w-full"
            className="aspect-[16/11] w-full object-cover"
          />
          {post.images.length > 1 && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
              +{post.images.length - 1} more
            </span>
          )}
        </div>
      )}
      <div className="space-y-1 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px]"
            style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
          >
            {isImageAvatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              avatar
            )}
          </span>
          <span className="truncate text-xs font-semibold">{name}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {timeAgoLabel(post.created_at)}
          </span>
          <CaretRightIcon className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </div>
        {post.content && (
          <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-foreground/80">
            {post.content}
          </p>
        )}
      </div>
    </button>
  );
}
