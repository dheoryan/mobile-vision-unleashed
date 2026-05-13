import { useState } from "react";
import { X, Send } from "lucide-react";
import { personById, tribeById } from "@/lib/mutuals-data";
import { useSocial, socialStore } from "@/lib/social-store";

export function CommentsModal({
  open, onClose, postId,
}: { open: boolean; onClose: () => void; postId: string | null }) {
  const social = useSocial();
  const [text, setText] = useState("");
  if (!open || !postId) return null;

  const post = social.posts.find((p) => p.id === postId);
  if (!post) return null;
  const tribe = tribeById(post.tribeId);
  const comments = social.comments[postId] ?? [];

  const send = () => {
    const t = text.trim();
    if (!t) return;
    socialStore.addComment(postId, t);
    setText("");
  };

  return (
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
          {comments.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">Be the first to comment.</p>
          ) : comments.map((c) => {
            const mine = c.authorId === "me";
            const author = mine ? null : personById(c.authorId);
            return (
              <div key={c.id} className="flex items-start gap-3">
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
          })}
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
              style={{ backgroundColor: tribe.colorVar }}
              aria-label="Send comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
