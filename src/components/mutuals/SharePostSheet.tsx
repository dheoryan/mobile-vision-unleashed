import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { ExportIcon } from "@phosphor-icons/react/dist/csr/Export";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeMark } from "./TribeMark";
import { useMyProfile } from "@/lib/profile-store";
import { useSharePostToDM } from "@/lib/messages-store";
import { useMyMoots } from "@/lib/social-store";
import { useSharePostToTribe } from "@/lib/tribe-room-store";
import { intentStore } from "@/lib/intent-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function RowAvatar({ avatar }: { avatar: string }) {
  const isImage = avatar.startsWith("data:") || avatar.startsWith("http");
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary/50 text-lg">
      {isImage ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : avatar}
    </span>
  );
}

/**
 * "Send to" picker for the in-app half of the share system - Moots and
 * joined Tribes, plus a "More options" row that falls back to whatever the
 * caller's own external-share flow is (native OS sheet / copy link). Moots
 * rather than existing DM threads: it's the actual "who can I message"
 * relationship in this app (an accepted Hello, see listMyMootProfiles), so
 * it includes people you haven't started a conversation with yet, not just
 * threads that already exist. Tap a row to send immediately, matching
 * WhatsApp's own forward picker rather than a multi-select-then-confirm
 * flow - the target list here is short enough (Moots + a handful of Tribes)
 * that a second confirmation step would just be friction.
 */
export function SharePostSheet({
  open,
  onOpenChange,
  postId,
  onExternalShare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  onExternalShare: () => void;
}) {
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const profile = useMyProfile();
  const { data: moots } = useMyMoots();
  const shareToDM = useSharePostToDM();
  const shareToTribe = useSharePostToTribe();

  const q = query.trim().toLowerCase();
  const dmTargets = (moots ?? []).filter(
    (m) =>
      !q || m.display_name.toLowerCase().includes(q) || (m.handle ?? "").toLowerCase().includes(q),
  );
  const tribeTargets = (profile?.tribeIds ?? [])
    .map((id) => tribeById(id))
    .filter((tribe) => !q || tribe.name.toLowerCase().includes(q));

  const close = () => {
    setQuery("");
    setCaption("");
    onOpenChange(false);
  };

  const sendToDM = (recipientId: string) => {
    if (sendingKey) return;
    setSendingKey(`dm:${recipientId}`);
    shareToDM.mutate(
      { recipient_id: recipientId, post_id: postId, caption: caption || null },
      {
        onSuccess: () => {
          toast.success("Sent");
          close();
          // Land the sharer in the conversation itself, not just wherever
          // they tapped Share from - the same "go straight to the thread"
          // intent a Message button on a profile already pushes.
          intentStore.push({ kind: "openThreadWith", userId: recipientId });
          void navigate({ to: "/" });
        },
        onError: (error) =>
          toast.error("Couldn't share", { description: (error as Error).message }),
        onSettled: () => setSendingKey(null),
      },
    );
  };

  const sendToTribe = (tribeId: TribeId) => {
    if (sendingKey) return;
    setSendingKey(`tribe:${tribeId}`);
    shareToTribe.mutate(
      { tribe_key: tribeId, post_id: postId, caption: caption || null },
      {
        onSuccess: () => {
          toast.success(`Shared to ${tribeById(tribeId).name}`);
          close();
          intentStore.push({ kind: "openTribe", tribeId });
          void navigate({ to: "/" });
        },
        onError: (error) =>
          toast.error("Couldn't share", { description: (error as Error).message }),
        onSettled: () => setSendingKey(null),
      },
    );
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={close}
      title="Share post"
      contentClassName="overflow-hidden"
    >
      <div className="flex max-h-[80vh] flex-col pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/35" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-3">
          <div>
            <p className="label-mono text-primary">SEND TO</p>
            <h2 className="mt-0.5 font-display text-xl font-bold">Share post</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close share sheet"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people and Tribes"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          {tribeTargets.length > 0 && (
            <div className="px-3 pb-1 pt-2">
              <p className="label-mono text-[10px] text-muted-foreground">TRIBES</p>
            </div>
          )}
          {tribeTargets.map((tribe) => {
            const key = `tribe:${tribe.id}`;
            return (
              <button
                key={key}
                type="button"
                disabled={Boolean(sendingKey)}
                onClick={() => sendToTribe(tribe.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/55 active:bg-secondary disabled:opacity-50"
              >
                <TribeMark tribe={tribe} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tribe.name}</span>
                {sendingKey === key ? (
                  <span className="text-xs text-muted-foreground">Sending…</span>
                ) : (
                  <PaperPlaneTiltIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}

          {dmTargets.length > 0 && (
            <div className="px-3 pb-1 pt-3">
              <p className="label-mono text-[10px] text-muted-foreground">MOOTS</p>
            </div>
          )}
          {dmTargets.map((moot) => {
            const key = `dm:${moot.id}`;
            const avatar = moot.avatar_url || moot.avatar_emoji || "🙂";
            return (
              <button
                key={key}
                type="button"
                disabled={Boolean(sendingKey)}
                onClick={() => sendToDM(moot.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/55 active:bg-secondary disabled:opacity-50"
              >
                <RowAvatar avatar={avatar} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {moot.display_name}
                </span>
                {sendingKey === key ? (
                  <span className="text-xs text-muted-foreground">Sending…</span>
                ) : (
                  <PaperPlaneTiltIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}

          {!tribeTargets.length && !dmTargets.length && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {q ? "No matches" : "Add a Moot or join a Tribe to share here"}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 pt-2">
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Add a message (optional)"
            maxLength={600}
            className={cn(
              "mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none",
              "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary",
            )}
          />
          <button
            type="button"
            onClick={() => {
              close();
              onExternalShare();
            }}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/55 active:bg-secondary"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground">
              <ExportIcon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">More options</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Share outside Meutuals, or copy the link
              </span>
            </span>
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
