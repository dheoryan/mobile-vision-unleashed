import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { X, Send, AlertTriangle, MessageSquare, Trash2, Reply } from "lucide-react";
import { useComments, useAddComment, useDeleteComment, type CommentRow } from "@/lib/posts-store";
import { useMyProfile } from "@/lib/profile-store";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/time";
import { toast } from "sonner";
import {
  useMentionPicker,
  useMentionRegistry,
  applyMention,
  collectMentionIds,
  MentionSuggestions,
} from "./MentionInput";

const TRIBE_FALLBACK = "var(--color-primary)";

export function CommentsModal({
  open, onClose, postId,
}: { open: boolean; onClose: () => void; postId: string | null }) {
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

  if (!open || !postId) return null;

  const tribeColor = TRIBE_FALLBACK;
  const roots = tree.get(null) ?? [];

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const mentions = collectMentionIds(t, registry);
    setText("");
    setCaret(0);
    const parent = replyTo;
    setReplyTo(null);
    addComment.mutate(
      { content: t, parent_id: parent?.id ?? null, mentions },
      { onError: (e) => toast.error("Comment didn't send", { description: (e as Error).message }) },
    );
  };

  const onPickMention = (p: { id: string; display_name: string; handle: string | null; avatar_emoji: string; avatar_url: string | null }) => {
    if (!p.handle) {
      toast.message("That user has no @handle yet");
      return;
    }
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

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto flex h-[80vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-card animate-rise">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-base font-bold">Comments</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
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
            <div className="mb-2 flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span>
                Replying to <span className="font-semibold text-foreground">{replyTo.author?.display_name || "comment"}</span>
              </span>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
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
                className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
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
      </div>
    </div>,
    document.body,
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

  return (
    <div className={`flex items-start gap-3 ${isPending ? "opacity-60" : ""}`}>
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
          <span>{isPending ? "sending…" : `${timeAgo(c.created_at)} ago`}</span>
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
