import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, AlertTriangle, MessageSquare } from "lucide-react";
import { personById, tribeById } from "@/lib/mutuals-data";
import { useSocial, socialStore, type Comment } from "@/lib/social-store";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function CommentsModal({
  open, onClose, postId,
}: { open: boolean; onClose: () => void; postId: string | null }) {
  const social = useSocial();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Comment[]>([]);
  const [failed, setFailed] = useState<Comment[]>([]);

  // Simulate fetching when modal opens
  useEffect(() => {
    if (!open || !postId) return;
    setLoading(true);
    setError(null);
    setPending([]);
    setFailed([]);
    const fail = Math.random() < 0.12;
    const t = setTimeout(() => {
      if (fail) {
        setError("Couldn't load comments. Check your connection and retry.");
      }
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [open, postId]);

  if (!open || !postId) return null;

  const post = social.posts.find((p) => p.id === postId);
  if (!post) return null;
  const tribe = tribeById(post.tribeId);
  const stored = social.comments[postId] ?? [];
  const visible = [...stored, ...pending];

  const retry = () => {
    setLoading(true);
    setError(null);
    setTimeout(() => setLoading(false), 500);
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const optimistic: Comment = { id: `tmp-${Date.now()}`, authorId: "me", text: t, time: "sending…" };
    setPending((p) => [...p, optimistic]);
    setText("");

    // Simulate network — small chance of failure
    await new Promise((r) => setTimeout(r, 500));
    const fail = Math.random() < 0.08;

    setPending((p) => p.filter((c) => c.id !== optimistic.id));
    if (fail) {
      setFailed((f) => [...f, optimistic]);
      toast.error("Comment didn't send", { description: "Tap retry below." });
    } else {
      socialStore.addComment(postId, t);
    }
  };

  const retryFailed = (c: Comment) => {
    setFailed((f) => f.filter((x) => x.id !== c.id));
    setText(c.text);
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

        <div className="border-b border-border px-5 py-3 text-sm text-muted-foreground">
          {post.content}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading ? (
            <SkeletonList tribeColor={tribe.colorVar} />
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-foreground">{error}</p>
              <button onClick={retry} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
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
              const mine = c.authorId === "me";
              const author = mine ? null : personById(c.authorId);
              const isPending = c.id.startsWith("tmp-");
              return (
                <div key={c.id} className={`flex items-start gap-3 ${isPending ? "opacity-60" : ""}`}>
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                    style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
                  >
                    {mine ? "🙂" : author?.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{mine ? "You" : author?.name}</p>
                    <p className="text-sm text-foreground">{c.text}</p>
                    <p className="text-[10px] text-muted-foreground">{c.time}</p>
                  </div>
                </div>
              );
            })
          )}

          {failed.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs font-semibold text-destructive">Failed to send</p>
              <ul className="mt-1 space-y-1">
                {failed.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">{c.text}</span>
                    <button onClick={() => retryFailed(c)} className="shrink-0 rounded-full bg-destructive px-3 py-1 text-[11px] font-semibold text-destructive-foreground">
                      Retry
                    </button>
                  </li>
                ))}
              </ul>
            </div>
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
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={!text.trim() || loading}
              className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground disabled:opacity-40"
              style={{ backgroundColor: tribe.colorVar }}
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
