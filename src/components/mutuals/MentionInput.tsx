import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchMentionProfiles } from "@/lib/profile.functions";

export type Mention = {
  id: string;
  handle: string;
  display_name: string;
};

type Profile = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string;
  avatar_url: string | null;
};

export function useMentionPicker(text: string, caret: number) {
  // detect "@<query>" right before the caret
  const upTo = text.slice(0, caret);
  const m = /(?:^|\s)@([\w.-]{0,30})$/.exec(upTo);
  const query = m ? m[1] : null;
  const start = m ? upTo.length - (m[1].length + 1) : -1;

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
    queryFn: () => fn({ data: { q: debounced || "a" } }),
    enabled: debounced !== null && debounced.length >= 0,
    staleTime: 30_000,
  });

  return {
    query,
    start,
    suggestions: (query !== null ? (q.data ?? []) : []) as Profile[],
    isLoading: q.isLoading && query !== null,
  };
}

/** Replace the active "@xxx" token in `text` with "@handle " and return the new text + the new caret pos. */
export function applyMention(
  text: string,
  caret: number,
  start: number,
  handle: string,
): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret);
  const insert = `@${handle} `;
  return { text: `${before}${insert}${after}`, caret: before.length + insert.length };
}

/** Extract mention user IDs from text by matching against a known map of @handle → id. */
export function collectMentionIds(text: string, knownHandles: Map<string, string>): string[] {
  const ids = new Set<string>();
  const re = /(?:^|\s)@([\w.-]{1,30})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const id = knownHandles.get(match[1].toLowerCase());
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

export function MentionSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: Profile[];
  onPick: (p: Profile) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover shadow-lg">
      {suggestions.map((p) => {
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
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary/60"
          >
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-card text-base">
              {isImg ? <img src={av} alt="" className="h-full w-full object-cover" /> : av}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.display_name || "Someone"}</span>
              {p.handle && <span className="block truncate text-[11px] text-muted-foreground">@{p.handle}</span>}
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
  const register = (p: Profile) => {
    if (p.handle) ref.current.set(p.handle.toLowerCase(), p.id);
  };
  return { register, registry: ref.current };
}
