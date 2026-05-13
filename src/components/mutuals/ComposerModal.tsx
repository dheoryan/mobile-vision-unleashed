import { useState } from "react";
import { X } from "lucide-react";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { socialStore } from "@/lib/social-store";
import { toast } from "sonner";

export function ComposerModal({
  open, onClose, tribeId,
}: { open: boolean; onClose: () => void; tribeId: TribeId }) {
  const [text, setText] = useState("");
  if (!open) return null;
  const tribe = tribeById(tribeId);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    socialStore.addPost(tribeId, t);
    setText("");
    onClose();
    toast.success("Posted to " + tribe.name);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 animate-rise">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <p className="label-mono text-muted-foreground">New post · {tribe.name}</p>
        <h2 className="font-display text-xl font-bold">What's happening?</h2>
        <textarea
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder="Share a plan, an invite, a small thing…"
          className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">{text.length}/280</div>
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="mt-4 w-full rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          style={{ backgroundColor: tribe.colorVar }}
        >
          Post
        </button>
      </div>
    </div>
  );
}
