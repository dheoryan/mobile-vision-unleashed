import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchMentionProfiles } from "@/lib/profile.functions";
import { mentionRangeAtCaret } from "@/lib/mentions";

export type Mention = {
  id: string;
  handle: string;
  display_name: string;
};

export type MentionProfile = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string;
  avatar_url: string | null;
};

export function useMentionPicker(text: string, caret: number) {
  const range = mentionRangeAtCaret(text, caret);
  const query = range?.query ?? null;
  const start = range?.start ?? -1;

  const [debounced, setDebounced] = useState<string | null>(null);
  useEffect(() => {
    if (query == null) {
      setDebounced(null);
      return;
    }
    const t = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  const fn = useServerFn(searchMentionProfiles);
  const q = useQuery({
    queryKey: ["mention-search", debounced ?? ""],
    queryFn: () => fn({ data: { q: debounced ?? "" } }),
    enabled: debounced !== null && debounced.length >= 0,
    staleTime: 30_000,
  });

  return {
    query,
    start,
    suggestions: (query !== null ? (q.data ?? []) : []) as MentionProfile[],
    isLoading: q.isLoading && query !== null,
  };
}

export function MentionSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: MentionProfile[];
  onPick: (p: MentionProfile) => void;
}) {
  const mentionable = suggestions.filter((profile) => Boolean(profile.handle));
  if (!mentionable.length) return null;
  return (
    <div className="scroll-panel absolute bottom-full left-0 right-0 z-30 mb-2 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover shadow-lg">
      {mentionable.map((p) => {
        const av = p.avatar_url || p.avatar_emoji || "🙂";
        const isImg = av.startsWith("data:") || av.startsWith("http");
        return (
          <button
            key={p.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(p);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-secondary/60 active:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-card text-base">
              {isImg ? <img src={av} alt="" className="h-full w-full object-cover" /> : av}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {p.display_name || "Someone"}
              </span>
              {p.handle && (
                <span className="block truncate text-[11px] text-muted-foreground">
                  @{p.handle}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Hook helper: maintain a handle → id map so collectMentionIds can resolve final mentions. */
export function useMentionRegistry() {
  const ref = useRef<Map<string, string>>(new Map());
  const register = (p: MentionProfile) => {
    if (p.handle) ref.current.set(p.handle.toLowerCase(), p.id);
  };
  return { register, registry: ref.current };
}
