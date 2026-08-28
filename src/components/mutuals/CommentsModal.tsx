import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Send, AlertTriangle, MessageSquare, Trash2, Reply } from "lucide-react";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { ReplyPreview } from "./ReplyPreview";
import { SafetyMenu } from "./SafetyMenu";
import { useComments, useAddComment, useDeleteComment, type CommentRow } from "@/lib/posts-store";
import { useMyProfile } from "@/lib/profile-store";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgoLabel } from "@/lib/time";
import { toast } from "sonner";
import {
  useMentionPicker,
  useMentionRegistry,
  MentionSuggestions,
} from "./MentionInput";
import { applyMention, collectMentionIds } from "@/lib/mentions";

const TRIBE_FALLBACK = "var(--color-primary)";

export function CommentsModal({
  open, onClose, postId, highlightCommentId,
}: { open: boolean; onClose: () => void; postId: string | null; highlightCommentId?: string | null }) {
  const me = useMyProfile();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commentsQuery = useComments(open ? postId : null);
  const addComment = useAddComment(postId ?? "");
  const deleteComment = useDeleteComment(postId ?? "");
  const { register, registry } = useMentionRegistry();
  const picker = useMentionPicker(text, caret);

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
    if (!open || !highlightCommentId || commentsQuery.isLoading) return;
    const attempt = (left: number) => {
      const el = document.querySelector<HTMLElement>(
        `[data-comment-id="${highlightCommentId}"]`,
      );
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
  }, [open, highlightCommentId, commentsQuery.isLoading, commentsQuery.data]);

  const tribeColor = TRIBE_FALLBACK;
  const roots = tree.get(null) ?? [];

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

  const onPickMention = (p: { id: string; display_name: string; handle: string | null; avatar_emoji: string; avatar_url: string | null }) => {
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
      if (c.author.id) register({ id: c.author.id, display_name: c.author.display_name, handle: c.author.handle, avatar_emoji: c.author.avatar_emoji, avatar_url: c.author.avatar_url });
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

  return (
    <AnimatedModal
      open={open && !!postId}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="Comments"
      contentClassName="flex h-[80vh] flex-col"
    >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-base font-bold">Comments</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="scroll-panel flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {commentsQuery.isLoading ? (
            <SkeletonList tribeColor={tribeColor} />
          ) : commentsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-foreground">Couldn't load comments.</p>
              <button onClick={() => commentsQuery.refetch()} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                Retry
              </button>
            </div>
          ) : roots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-semibold">No comments yet</p>
              <p className="text-xs text-muted-foreground">Be the first to say something.</p>
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
                onDelete={(id) => deleteComment.mutate(id)}
              />
            ))
          )}
        </div>

        <div className="relative border-t border-border p-3">
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
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
              <input
                ref={inputRef}
                value={text}
                onChange={onChange}
                onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                onClick={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={replyTo ? "Write a reply…" : "Add a comment — try @"}
                className="min-w-0 flex-1 bg-transparent text-base placeholder:text-muted-foreground focus:outline-none sm:text-sm"
              />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground disabled:opacity-40"
                style={{ backgroundColor: tribeColor }}
                aria-label="Send comment"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
    </AnimatedModal>
  );
}

function CommentNode({
  c, replies, tribeColor, meId, meAvatar, meName, onReply, onDelete,
}: {
  c: CommentRow;
  replies: CommentRow[];
  tribeColor: string;
  meId: string | null;
  meAvatar: string;
  meName: string;
  onReply: (c: CommentRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <CommentItem c={c} tribeColor={tribeColor} meId={meId} meAvatar={meAvatar} meName={meName} onReply={onReply} onDelete={onDelete} />
      {replies.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border/60 pl-4">
          {replies.map((r) => (
            <CommentItem key={r.id} c={r} tribeColor={tribeColor} meId={meId} meAvatar={meAvatar} meName={meName} onReply={onReply} onDelete={onDelete} />
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
  c, tribeColor, meId, meAvatar, meName, onReply, onDelete,
}: {
  c: CommentRow;
  tribeColor: string;
  meId: string | null;
  meAvatar: string;
  meName: string;
  onReply: (c: CommentRow) => void;
  onDelete: (id: string) => void;
}) {
  const mine = !!meId && c.author_id === meId;
  const isPending = c.id.startsWith("tmp-");
  const avatar = mine
    ? meAvatar
    : (c.author?.avatar_url || c.author?.avatar_emoji || "🙂");
  const name = mine
    ? meName
    : (c.author?.display_name || "Someone");
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
      try { navigator.vibrate?.(15); } catch { /* noop */ }
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
            <Reply className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        className={`flex items-start gap-3 touch-pan-y ${isPending ? "opacity-60" : ""}`}
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {handle && !mine ? (
              <Link to="/u/$handle" params={{ handle }} className="text-xs font-semibold hover:underline">{name}</Link>
            ) : (
              <p className="text-xs font-semibold">{name}</p>
            )}
          </div>
          <p className="text-sm text-foreground">{renderContent(c.content)}</p>
          <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{isPending ? "sending…" : timeAgoLabel(c.created_at)}</span>
            {!isPending && (
              <button onClick={() => onReply(c)} className="inline-flex items-center gap-1 hover:text-foreground">
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
          </div>
        </div>
        {mine && !isPending && (
          <button
            onClick={() => onDelete(c.id)}
            aria-label="Delete comment"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {!mine && !isPending && (
          <SafetyMenu
            targetName={name}
            targetUserId={c.author_id}
            targetCommentId={c.id}
            kind="comment"
            className="-mr-2 -mt-1"
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
          <Skeleton className="h-8 w-8 rounded-full" style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 18%, transparent)` }} />
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
