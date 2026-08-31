import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { ChatTextIcon } from "@phosphor-icons/react/dist/csr/ChatText";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendUpLeft";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { RepeatIcon } from "@phosphor-icons/react/dist/csr/Repeat";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { ReplyPreview } from "./ReplyPreview";
import { SafetyMenu } from "./SafetyMenu";
import {
  useComments,
  useAddComment,
  useDeleteComment,
  useHideComment,
  useHiddenComments,
  useUnhideComment,
  useMyCommentLikes,
  useMyCommentReposts,
  useToggleCommentLike,
  useToggleCommentRepost,
  type CommentRow,
} from "@/lib/posts-store";
import { useMyProfile } from "@/lib/profile-store";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "./Skeleton";
import { timeAgoLabel } from "@/lib/time";
import { toast } from "sonner";
import { useMentionPicker, useMentionRegistry, MentionSuggestions } from "./MentionInput";
import { applyMention, collectMentionIds } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { type TribeId } from "@/lib/mutuals-data";
import { RepostAudienceChoices, type RepostAudience } from "./RepostAudienceChoices";

const TRIBE_FALLBACK = "var(--color-primary)";

export function CommentsThread({
  postId,
  sourceAudience,
  sourceTribeId,
  highlightCommentId,
  isPostOwner = false,
}: {
  postId: string;
  sourceAudience: "tribe" | "all";
  sourceTribeId: TribeId;
  highlightCommentId?: string | null;
  /** Lets the post's author hide someone else's comment on it, separate
   *  from the delete action every commenter already has on their own. Only
   *  wired at the call site that has this cheaply (PostCard already knows
   *  whether the viewer owns the post) - omitted elsewhere rather than
   *  fetching the post just to answer this one question. */
  isPostOwner?: boolean;
}) {
  const me = useMyProfile();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [repostTarget, setRepostTarget] = useState<CommentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommentRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const visualViewport = useVisualViewport(true);

  const commentsQuery = useComments(postId);
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);
  const commentLikes = useMyCommentLikes(postId);
  const commentReposts = useMyCommentReposts(postId);
  const toggleCommentLike = useToggleCommentLike(postId);
  const toggleCommentRepost = useToggleCommentRepost(postId);
  const hideComment = useHideComment(postId);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  // Only fetched once the panel is actually opened - most posts have
  // nothing hidden, so this shouldn't be a query that fires every time any
  // comments view opens.
  const hiddenQuery = useHiddenComments(postId, isPostOwner && hiddenOpen);
  const unhideComment = useUnhideComment(postId);
  const { register, registry } = useMentionRegistry();
  const picker = useMentionPicker(text, caret);
  const myTribeId = me?.tribeIds[0] ?? sourceTribeId;

  // tree grouping
  const tree = useMemo(() => {
    const all = commentsQuery.data ?? [];
    const byParent = new Map<string | null, CommentRow[]>();
    for (const c of all) {
      const k = c.parent_id ?? null;
      const arr = byParent.get(k) ?? [];
      arr.push(c);
      byParent.set(k, arr);
    }
    return byParent;
  }, [commentsQuery.data]);

  // Scroll to + flash a specific comment when opened from a notification
  useEffect(() => {
    if (!highlightCommentId || commentsQuery.isLoading) return;
    const attempt = (left: number) => {
      const el = document.querySelector<HTMLElement>(`[data-comment-id="${highlightCommentId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "rounded-lg");
        window.setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "rounded-lg");
        }, 2200);
        return;
      }
      if (left > 0) window.setTimeout(() => attempt(left - 1), 100);
    };
    const t = window.setTimeout(() => attempt(15), 80);
    return () => window.clearTimeout(t);
  }, [highlightCommentId, commentsQuery.isLoading, commentsQuery.data]);

  const tribeColor = TRIBE_FALLBACK;
  const roots = tree.get(null) ?? [];

  const changeCommentRepost = (audience: RepostAudience) => {
    if (!repostTarget) return;
    const commentId = repostTarget.id;
    const wasReposted = repostTargetActive;
    setRepostTarget(null);
    toggleCommentRepost.mutate(
      { commentId, audience },
      {
        onSuccess: (result) =>
          toast.success(
            result.reposted
              ? audience === "tribe"
                ? "Comment reposted to your Tribe"
                : "Comment reposted to The Wild"
              : "Comment repost removed",
          ),
        onError: (error) =>
          toast.error(wasReposted ? "Repost wasn't removed" : "Comment wasn't reposted", {
            description: (error as Error).message,
          }),
      },
    );
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const mentions = collectMentionIds(t, registry);
    setText("");
    setCaret(0);
    const parent = replyTo;
    // Flatten nested replies: a reply to a reply attaches to the root comment
    // so the whole conversation stays in one thread (Instagram-style).
    const rootParentId = parent ? (parent.parent_id ?? parent.id) : null;
    setReplyTo(null);
    addComment.mutate(
      { content: t, parent_id: rootParentId, mentions },
      { onError: (e) => toast.error("Comment didn't send", { description: (e as Error).message }) },
    );
  };

  const onPickMention = (p: {
    id: string;
    display_name: string;
    handle: string | null;
    avatar_emoji: string;
    avatar_url: string | null;
  }) => {
    if (!p.handle) return;
    register(p);
    if (picker.start < 0) return;
    const next = applyMention(text, caret, picker.start, p.handle);
    setText(next.text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
        setCaret(next.caret);
      }
    });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
  };

  const startReply = (c: CommentRow) => {
    setReplyTo(c);
    if (c.author?.handle) {
      const prefix = `@${c.author.handle} `;
      if (c.author.id)
        register({
          id: c.author.id,
          display_name: c.author.display_name,
          handle: c.author.handle,
          avatar_emoji: c.author.avatar_emoji,
          avatar_url: c.author.avatar_url,
        });
      setText((prev) => (prev.startsWith(prefix) ? prev : prefix + prev.replace(/^@\S+\s*/, "")));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        const len = inputRef.current?.value.length ?? 0;
        inputRef.current?.setSelectionRange(len, len);
        setCaret(len);
      });
    } else {
      inputRef.current?.focus();
    }
  };

  const repostTargetActive = repostTarget
    ? (commentReposts.data?.has(repostTarget.id) ?? false)
    : false;

  return (
    <>
      <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-20">
        <header className="flex min-h-14 items-center justify-between gap-3 border-y border-border/80 px-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="label-mono text-primary">REPLIES</p>
            <h2 id="comments-heading" className="sr-only">
              Replies
            </h2>
          </div>
          {!commentsQuery.isLoading && (
            <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {commentsQuery.data?.length ?? 0}{" "}
              {(commentsQuery.data?.length ?? 0) === 1 ? "reply" : "replies"}
            </span>
          )}
        </header>

        {isPostOwner && (
          <div className="shrink-0 border-b border-border">
            <button
              type="button"
              onClick={() => setHiddenOpen((v) => !v)}
              className="flex min-h-11 w-full items-center gap-1.5 px-4 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <EyeSlashIcon className="h-3.5 w-3.5" />
              Comments you've hidden
              <CaretDownIcon
                className={cn("h-3.5 w-3.5 transition-transform", hiddenOpen && "rotate-180")}
              />
            </button>
            {hiddenOpen && (
              <div className="max-h-40 space-y-2 overflow-y-auto px-5 pb-3">
                {hiddenQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : hiddenQuery.isError ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Couldn't load this.</p>
                    <button
                      onClick={() => hiddenQuery.refetch()}
                      className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Retry
                    </button>
                  </div>
                ) : !hiddenQuery.data?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing here - comments you hide on this post will show up in this list.
                  </p>
                ) : (
                  hiddenQuery.data.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-2 rounded-xl border border-border bg-card p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {c.author?.display_name || "Someone"}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.content}</p>
                      </div>
                      <button
                        onClick={() =>
                          unhideComment.mutate(c.id, {
                            onError: (error) =>
                              toast.error("Comment wasn't unhidden", {
                                description: (error as Error).message,
                              }),
                          })
                        }
                        disabled={unhideComment.isPending && unhideComment.variables === c.id}
                        className="flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                      >
                        <EyeIcon className="h-3 w-3" /> Unhide
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 py-3">
          {commentsQuery.isLoading ? (
            <SkeletonList tribeColor={tribeColor} />
          ) : commentsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <WarningIcon className="h-10 w-10 text-destructive" />
              <p className="text-sm text-foreground">Couldn't load comments.</p>
              <button
                onClick={() => commentsQuery.refetch()}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Retry
              </button>
            </div>
          ) : roots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ChatTextIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-semibold">No replies yet</p>
              <p className="text-xs text-muted-foreground">
                Be the first to respond to this signal.
              </p>
            </div>
          ) : (
            roots.map((c) => (
              <CommentNode
                key={c.id}
                c={c}
                replies={tree.get(c.id) ?? []}
                tribeColor={tribeColor}
                meId={user?.id ?? null}
                meAvatar={me?.avatar ?? "🙂"}
                meName={me?.name?.trim() || "You"}
                onReply={startReply}
                onDelete={setDeleteTarget}
                isPostOwner={isPostOwner}
                onHide={(id) => hideComment.mutate(id)}
                likedIds={commentLikes.data ?? new Set<string>()}
                repostedIds={commentReposts.data ?? new Set<string>()}
                onLike={(id) =>
                  toggleCommentLike.mutate(id, {
                    onError: (error) =>
                      toast.error("Like wasn't updated", {
                        description: (error as Error).message,
                      }),
                  })
                }
                onRepost={setRepostTarget}
              />
            ))
          )}
        </div>

        <div
          className={cn(
            "glass sticky bottom-0 z-10 -mx-1 border-t border-border/80 px-1 pt-2 shadow-[0_-14px_36px_rgba(0,0,0,0.22)]",
            visualViewport.keyboardOpen ? "pb-3" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
          style={
            visualViewport.keyboardOpen && visualViewport.bottomInset > 0
              ? { bottom: `${visualViewport.bottomInset}px` }
              : undefined
          }
        >
          {replyTo && (
            <ReplyPreview
              name={replyTo.author?.display_name || "comment"}
              snippet={replyTo.content || ""}
              accentColor={tribeColor}
              onCancel={() => setReplyTo(null)}
            />
          )}
          <div className="relative">
            <MentionSuggestions suggestions={picker.suggestions} onPick={onPickMention} />
            <div className="flex min-h-12 items-center gap-2 rounded-full border border-border/90 bg-background/75 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]">
              <input
                ref={inputRef}
                value={text}
                onChange={onChange}
                onKeyUp={(e) =>
                  setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length)
                }
                onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={replyTo ? "Write a reply…" : "Add a comment — try @"}
                className="min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none sm:text-sm"
              />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-transform active:scale-90 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                style={{ backgroundColor: tribeColor }}
                aria-label="Send comment"
              >
                <PaperPlaneTiltIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <AnimatedModal
        open={!!repostTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRepostTarget(null);
        }}
        title="Repost options"
        contentClassName="overflow-hidden"
        zIndex={60}
      >
        <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/35" />
          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <div>
              <p className="label-mono text-primary">PASS IT ON</p>
              <h2 className="mt-0.5 font-display text-xl font-bold">Repost comment</h2>
            </div>
            <button
              type="button"
              onClick={() => setRepostTarget(null)}
              aria-label="Close repost options"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {repostTargetActive ? (
            <button
              type="button"
              disabled={!repostTarget || toggleCommentRepost.isPending}
              onClick={() => changeCommentRepost("tribe")}
              className="group flex min-h-[4.75rem] w-full items-center gap-3 border-y border-border px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
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
          ) : (
            <RepostAudienceChoices
              tribeId={myTribeId}
              allowWild={sourceAudience === "all"}
              disabled={!repostTarget || toggleCommentRepost.isPending}
              onSelect={changeCommentRepost}
            />
          )}
        </div>
      </AnimatedModal>

      <AnimatedModal
        open={!!deleteTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteComment.isPending) setDeleteTarget(null);
        }}
        title="Delete this reply?"
        center
        preventClose={deleteComment.isPending}
        contentClassName="mx-4 max-w-sm p-5"
        zIndex={70}
      >
        <p className="label-mono text-destructive">REMOVE REPLY</p>
        <h2 className="mt-1 font-display text-lg font-bold">Delete this reply?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This reply will disappear from the signal thread. If it has replies, they’ll be removed
          too. This can’t be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deleteComment.isPending}
            className="min-h-11 rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            Keep reply
          </button>
          <button
            type="button"
            onClick={() => {
              if (!deleteTarget) return;
              deleteComment.mutate(deleteTarget.id, {
                onSuccess: () => {
                  setDeleteTarget(null);
                  toast.success("Reply deleted");
                },
                onError: (error) =>
                  toast.error("Reply wasn't deleted", {
                    description: (error as Error).message,
                  }),
              });
            }}
            disabled={!deleteTarget || deleteComment.isPending}
            className="min-h-11 rounded-full bg-destructive px-4 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
          >
            {deleteComment.isPending ? "Deleting…" : "Delete reply"}
          </button>
        </div>
      </AnimatedModal>
    </>
  );
}

function CommentNode({
  c,
  replies,
  tribeColor,
  meId,
  meAvatar,
  meName,
  onReply,
  onDelete,
  isPostOwner,
  onHide,
  likedIds,
  repostedIds,
  onLike,
  onRepost,
}: {
  c: CommentRow;
  replies: CommentRow[];
  tribeColor: string;
  meId: string | null;
  meAvatar: string;
  meName: string;
  onReply: (c: CommentRow) => void;
  onDelete: (comment: CommentRow) => void;
  isPostOwner: boolean;
  onHide: (id: string) => void;
  likedIds: Set<string>;
  repostedIds: Set<string>;
  onLike: (id: string) => void;
  onRepost: (comment: CommentRow) => void;
}) {
  return (
    <div>
      <CommentItem
        c={c}
        tribeColor={tribeColor}
        meId={meId}
        meAvatar={meAvatar}
        meName={meName}
        onReply={onReply}
        onDelete={onDelete}
        isPostOwner={isPostOwner}
        onHide={onHide}
        liked={likedIds.has(c.id)}
        reposted={repostedIds.has(c.id)}
        onLike={onLike}
        onRepost={onRepost}
      />
      {replies.length > 0 && (
        <div className="relative ml-4 mt-1 space-y-1 pl-6 before:absolute before:bottom-5 before:left-0 before:top-1 before:w-px before:bg-border/70">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              c={r}
              tribeColor={tribeColor}
              meId={meId}
              meAvatar={meAvatar}
              meName={meName}
              onReply={onReply}
              onDelete={onDelete}
              isPostOwner={isPostOwner}
              onHide={onHide}
              liked={likedIds.has(r.id)}
              reposted={repostedIds.has(r.id)}
              onLike={onLike}
              onRepost={onRepost}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function renderContent(content: string) {
  // turn @handle into a link
  const parts = content.split(/(\s)/);
  return parts.map((p, i) => {
    const m = /^@([\w.-]{1,30})$/.exec(p);
    if (m) {
      return (
        <Link
          key={i}
          to="/u/$handle"
          params={{ handle: m[1] }}
          className="font-semibold text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          @{m[1]}
        </Link>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function CommentItem({
  c,
  tribeColor,
  meId,
  meAvatar,
  meName,
  onReply,
  onDelete,
  isPostOwner,
  onHide,
  liked,
  reposted,
  onLike,
  onRepost,
}: {
  c: CommentRow;
  tribeColor: string;
  meId: string | null;
  meAvatar: string;
  meName: string;
  onReply: (c: CommentRow) => void;
  onDelete: (comment: CommentRow) => void;
  isPostOwner: boolean;
  onHide: (id: string) => void;
  liked: boolean;
  reposted: boolean;
  onLike: (id: string) => void;
  onRepost: (comment: CommentRow) => void;
}) {
  const mine = !!meId && c.author_id === meId;
  const isPending = c.id.startsWith("tmp-");
  const avatar = mine ? meAvatar : c.author?.avatar_url || c.author?.avatar_emoji || "🙂";
  const name = mine ? meName : c.author?.display_name || "Someone";
  const isImg = avatar.startsWith("data:") || avatar.startsWith("http");
  const handle = c.author?.handle ?? c.author?.id ?? null;

  // Swipe-right / long-press to reply (Telegram/iMessage style)
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);
  const SWIPE_THRESHOLD = 56;
  const MAX_DRAG = 80;

  const triggerReply = () => {
    if (triggered.current || isPending) return;
    triggered.current = true;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(15);
      } catch {
        /* noop */
      }
    }
    onReply(c);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPending) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
    triggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => triggerReply(), 450);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axis.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current === "y") {
      clearLongPress();
      return;
    }
    clearLongPress();
    const next = Math.max(0, Math.min(MAX_DRAG, dx));
    setDragX(next);
    if (next >= SWIPE_THRESHOLD) triggerReply();
  };

  const endDrag = () => {
    clearLongPress();
    startX.current = null;
    startY.current = null;
    axis.current = null;
    setDragX(0);
  };

  useEffect(() => () => clearLongPress(), []);

  return (
    <div className="relative select-none" data-comment-id={c.id}>
      {dragX > 4 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start pl-2 text-muted-foreground"
          style={{ opacity: Math.min(1, dragX / SWIPE_THRESHOLD) }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 24%, transparent)` }}
          >
            <ArrowBendUpLeftIcon className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        className={`flex items-start gap-2.5 rounded-2xl px-1 py-1 touch-pan-y transition-colors hover:bg-secondary/20 ${isPending ? "opacity-60" : ""}`}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragX === 0 ? "transform 180ms ease-out" : "none",
        }}
      >
        {handle && !mine ? (
          <Link
            to="/u/$handle"
            params={{ handle }}
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-base"
            style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 28%, transparent)` }}
          >
            {isImg ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : avatar}
          </Link>
        ) : (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-base"
            style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 28%, transparent)` }}
          >
            {isImg ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : avatar}
          </span>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-baseline gap-1.5">
            {handle && !mine ? (
              <Link
                to="/u/$handle"
                params={{ handle }}
                className="truncate text-xs font-semibold hover:underline"
              >
                {name}
              </Link>
            ) : (
              <p className="truncate text-xs font-semibold">{name}</p>
            )}
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {isPending ? "sending…" : timeAgoLabel(c.created_at)}
            </span>
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground">
            {renderContent(c.content)}
          </p>
          <div className="-mb-1 mt-0.5 flex min-h-11 items-center gap-1 text-[10px] text-muted-foreground">
            {!isPending && (
              <button
                onClick={() => onReply(c)}
                className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 transition-colors hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Reply
              </button>
            )}
            {!isPending && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onLike(c.id)}
                aria-label={liked ? "Unlike comment" : "Like comment"}
                aria-pressed={liked}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1 rounded-full px-2 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  liked ? "text-rose-400" : "hover:text-rose-400",
                )}
              >
                <HeartIcon className="h-3.5 w-3.5" weight={liked ? "fill" : "regular"} />
                {c.likes_count > 0 && <span>{c.likes_count}</span>}
              </button>
            )}
            {!isPending && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onRepost(c)}
                aria-label="Repost options"
                aria-pressed={reposted}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1 rounded-full px-2 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  reposted ? "text-emerald-400" : "hover:text-emerald-400",
                )}
              >
                <RepeatIcon className="h-3.5 w-3.5" weight={reposted ? "fill" : "regular"} />
                {c.reposts_count > 0 && <span>{c.reposts_count}</span>}
              </button>
            )}
          </div>
        </div>
        {mine && !isPending && (
          <button
            onClick={() => onDelete(c)}
            aria-label="Delete comment"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {!mine && !isPending && (
          <SafetyMenu
            targetName={name}
            targetUserId={c.author_id}
            targetCommentId={c.id}
            kind="comment"
            className="-mr-2 -mt-1"
            onHideComment={isPostOwner ? () => onHide(c.id) : undefined}
          />
        )}
      </div>
    </div>
  );
}

function SkeletonList({ tribeColor }: { tribeColor: string }) {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton
            className="h-8 w-8 rounded-full"
            style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 18%, transparent)` }}
          />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
