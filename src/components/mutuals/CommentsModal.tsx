import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, AlertTriangle, MessageSquare, Trash2 } from "lucide-react";
import { useComments, useAddComment, useDeleteComment } from "@/lib/posts-store";
import { useMyProfile } from "@/lib/profile-store";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/time";
import { toast } from "sonner";

const TRIBE_FALLBACK = "var(--color-primary)";

export function CommentsModal({
  open, onClose, postId,
}: { open: boolean; onClose: () => void; postId: string | null }) {
  const me = useMyProfile();
  const { user } = useAuth();
  const [text, setText] = useState("");

  const commentsQuery = useComments(open ? postId : null);
  const addComment = useAddComment(postId ?? "");
  const deleteComment = useDeleteComment(postId ?? "");

  if (!open || !postId) return null;

  const tribeColor = TRIBE_FALLBACK;
  const visible = commentsQuery.data ?? [];

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    addComment.mutate(t, {
      onError: (e) => toast.error("Comment didn't send", { description: (e as Error).message }),
    });
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
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-semibold">No comments yet</p>
              <p className="text-xs text-muted-foreground">Be the first to say something.</p>
            </div>
          ) : (
            visible.map((c) => {
              const mine = !!user && c.author_id === user.id;
              const isPending = c.id.startsWith("tmp-");
              const avatar = mine
                ? (me?.avatar ?? "🙂")
                : (c.author?.avatar_url || c.author?.avatar_emoji || "🙂");
              const name = mine
                ? (me?.name?.trim() || "You")
                : (c.author?.display_name || "Someone");
              const isImg = avatar.startsWith("data:") || avatar.startsWith("http");
              return (
                <div key={c.id} className={`flex items-start gap-3 ${isPending ? "opacity-60" : ""}`}>
                  <span
                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-base"
                    style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 28%, transparent)` }}
                  >
                    {isImg ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{name}</p>
                    <p className="text-sm text-foreground">{c.content}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isPending ? "sending…" : `${timeAgo(c.created_at)} ago`}
                    </p>
                  </div>
                  {mine && !isPending && (
                    <button
                      onClick={() => deleteComment.mutate(c.id)}
                      aria-label="Delete comment"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Add a comment"
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
    </div>,
    document.body,
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
