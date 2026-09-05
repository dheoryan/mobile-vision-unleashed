import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";
import { ChatTextIcon } from "@phosphor-icons/react/dist/csr/ChatText";
import type { CommentRow } from "@/lib/posts-store";
import { timeAgoLabel } from "@/lib/time";
import { LazyImage } from "./LazyImage";

/** Read-only source card inside a comment repost. Keeping it separate from a
 * live CommentItem avoids nested actions and ambiguous tap targets. */
export function QuotedCommentPreview({ comment }: { comment: CommentRow }) {
  const name = comment.author?.display_name?.trim() || "Someone";
  const handle = comment.author?.handle?.trim();
  const avatar = comment.author?.avatar_url || comment.author?.avatar_emoji || "🙂";
  const imageAvatar = avatar.startsWith("data:") || avatar.startsWith("http");

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/35 p-3">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <ChatTextIcon className="h-3 w-3" /> Reposted comment
      </div>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm">
          {imageAvatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            avatar
          )}
        </span>
        <span className="min-w-0 truncate text-xs font-semibold">{name}</span>
        {handle && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">@{handle}</span>
        )}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {timeAgoLabel(comment.created_at)}
        </span>
      </div>
      {comment.content && (
        <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {comment.content}
        </p>
      )}
      {comment.image_url && (
        <LazyImage
          src={comment.image_url}
          alt=""
          wrapperClassName="mt-2 max-w-[10rem] rounded-lg border border-border"
          className="max-h-40 w-full rounded-lg object-cover"
        />
      )}
    </div>
  );
}

export function QuotedCommentUnavailable() {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
      <ProhibitIcon className="h-3.5 w-3.5 shrink-0" />
      This comment is no longer available.
    </div>
  );
}
