import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, MapPin, PenLine, Search, X } from "lucide-react";
import { resolvePlace, searchPlaces, type PlaceSuggestion } from "@/lib/places.functions";
import { GOOGLE_PLACES_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

/**
 * Picking where a Venture happens.
 *
 * ---------- the session token ----------
 *
 * One token spans the whole interaction: every keystroke, and the single
 * details call that ends it. With it, autocomplete requests bill at "Autocomplete
 * Session Usage" — unlimited and free. Without it they bill individually. It is
 * generated once when the picker opens and thrown away after a place is chosen,
 * because a token reused across two searches is two sessions charged as one and
 * Google will eventually notice.
 *
 * ---------- why the host types both fields ----------
 *
 * Google's terms forbid storing a place's displayName OR its address. So every
 * suggestion here is rendered and discarded — that is display, not caching —
 * and both values saved on the Venture are the host's own words: what they call
 * the place, and which area it is in.
 *
 * The first draft of this file asked for the name and then quietly saved
 * Google's formatted address as the area, which is the same rule broken one
 * line later. Asking for both is the consistent reading, and it turned out to
 * be the better product too: a free-text venue used to have no area at all, so
 * somebody's rooftop showed on the board as a name floating with no location.
 *
 * What proves a place is real was never either string. It is the place_id
 * travelling beside them, which may be kept forever.
 */

export type PickedVenue = {
  google_place_id: string | null;
  host_label: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
};

type Stage = "manual" | "search" | "label";

export function VenuePicker({
  value,
  onChange,
  viewerLat,
  viewerLng,
}: {
  value: PickedVenue | null;
  onChange: (venue: PickedVenue | null) => void;
  viewerLat?: number;
  viewerLng?: number;
}) {
  const search = useServerFn(searchPlaces);
  const resolve = useServerFn(resolvePlace);

  // Human language is the default. Google is an optional precision upgrade,
  // so opening this sheet never starts a Places session or implies that a
  // venue needs a map listing to be legitimate.
  const [stage, setStage] = useState<Stage>("manual");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The place the host tapped, waiting on a label.
  const [chosen, setChosen] = useState<{
    place_id: string | null;
    suggestion: string;
    area: string;
    latitude: number | null;
    longitude: number | null;
  } | null>(null);
  const [label, setLabel] = useState("");
  const [area, setArea] = useState("");

  const sessionToken = useMemo(() => crypto.randomUUID(), []);
  const tokenRef = useRef(sessionToken);

  // Debounced, because a request per keystroke is both slower and — without the
  // session token doing its job — the expensive way to spell a café's name.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void search({
        data: {
          query: q,
          session_token: tokenRef.current,
          ...(viewerLat != null && viewerLng != null
            ? { latitude: viewerLat, longitude: viewerLng }
            : {}),
        },
      })
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setResults([]);
          setError((err as Error).message);
        })
        .finally(() => !cancelled && setSearching(false));
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, search, viewerLat, viewerLng]);

  const pick = async (suggestion: PlaceSuggestion) => {
    setSearching(true);
    setError(null);
    try {
      const detail = await resolve({
        data: { place_id: suggestion.place_id, session_token: tokenRef.current },
      });
      setChosen({
        place_id: detail.place_id,
        suggestion: suggestion.primary,
        area: suggestion.secondary,
        latitude: detail.latitude,
        longitude: detail.longitude,
      });
      setLabel("");
      setArea("");
      setStage("label");
      // Session spent. The next search starts a fresh one.
      tokenRef.current = crypto.randomUUID();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  /**
   * Return from optional Google search to the primary manual path.
   *
   * Whatever is in the search box carries over as a starting point, because if
   * someone has typed "Bloo" and given up, that is still what they call it.
   */
  const useFreeText = () => {
    setChosen(null);
    if (query.trim()) setLabel(query.trim());
    setStage("manual");
  };

  const ready = Boolean(label.trim() && area.trim());

  const confirmGoogle = () => {
    if (!chosen || !ready) return;
    onChange({
      google_place_id: chosen.place_id,
      host_label: label.trim(),
      area: area.trim(),
      latitude: chosen.latitude,
      longitude: chosen.longitude,
    });
  };

  const confirmManual = () => {
    if (!ready) return;
    onChange({
      google_place_id: null,
      host_label: label.trim(),
      area: area.trim(),
      latitude: null,
      longitude: null,
    });
  };

  // Already chosen — show it, with a way back.
  if (value) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{value.host_label}</span>
            {value.google_place_id && (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-accent"
                aria-label="Verified place"
              />
            )}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{value.area}</p>
          {!value.google_place_id && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Host-named place · map optional
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setStage("manual");
            setQuery("");
            setResults([]);
            setChosen(null);
          }}
          aria-label="Change venue"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (stage === "manual") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
          <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold">Name the place your way</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Add the place and its area exactly how you would tell a friend. A map pin is optional.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="label-mono text-muted-foreground">What do you call it?</span>
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value.slice(0, 120))}
            placeholder="Kopi Kalyan"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label-mono text-muted-foreground">Which area?</span>
          <input
            value={area}
            onChange={(event) => setArea(event.target.value.slice(0, 160))}
            placeholder="Kemang, Jakarta Selatan"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <span className="text-[10px] leading-relaxed text-muted-foreground">
            This is what people use to decide whether the trip works for them.
          </span>
        </label>

        <button
          type="button"
          onClick={confirmManual}
          disabled={!ready}
          className="rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Use this place
        </button>

        {GOOGLE_PLACES_ENABLED && (
          <>
            <div className="flex items-center gap-3 py-1" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="label-mono text-muted-foreground">Optional precision</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => {
                setQuery(label.trim());
                setResults([]);
                setError(null);
                setStage("search");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              <MapPin className="h-3.5 w-3.5" />
              Find a verified pin with Google Maps
            </button>
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
              Adds distance guidance and an optional map for accepted participants.
            </p>
          </>
        )}
      </div>
    );
  }

  if (stage === "label" && chosen) {
    return (
      <div className="flex flex-col gap-3">
        {/* What Google matched, shown so the host knows which result they tapped.
            Rendered and discarded — never saved. Both fields below are the
            host's own words, including the area: Google's formatted address is
            the same forbidden-to-store category as its displayName, and storing
            one while carefully avoiding the other was just inconsistent. */}
        {chosen.place_id && (
          <div className="flex items-start gap-2 rounded-xl bg-secondary/40 p-3">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{chosen.suggestion}</p>
              {chosen.area && (
                <p className="truncate text-[11px] text-muted-foreground">{chosen.area}</p>
              )}
              <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-accent">
                Matched on Google
              </p>
            </div>
          </div>
        )}

        {!chosen.place_id && (
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-border p-3">
            <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              An unlisted place. It works exactly like any other Venture — it just has no map pin,
              so no distance shows on the board.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="label-mono text-muted-foreground">What do you call it?</span>
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value.slice(0, 120))}
            placeholder={chosen.suggestion || "Kopi Kalyan"}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="label-mono text-muted-foreground">Which area?</span>
          <input
            value={area}
            onChange={(event) => setArea(event.target.value.slice(0, 160))}
            placeholder={chosen.area || "Kemang, Jakarta Selatan"}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Your words, not Google's. This is the line people read on the board when they are
            deciding whether it is near enough to bother.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStage("search");
              setChosen(null);
            }}
            className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground"
          >
            Back
          </button>
          <button
            type="button"
            onClick={confirmGoogle}
            disabled={!ready}
            className="flex-[1.4] rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Use this place
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 pb-1">
        <div>
          <p className="text-xs font-semibold">Find a verified pin</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            Optional—use this when distance and map guidance will help the group.
          </p>
        </div>
        <button
          type="button"
          onClick={useFreeText}
          className="min-h-9 shrink-0 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          Enter manually
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 120))}
          placeholder="Café, bar, park…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {searching && (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[11px] leading-relaxed text-destructive">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          {results.map((row, index) => (
            <button
              key={row.place_id}
              type="button"
              onClick={() => void pick(row)}
              className={cn(
                "flex w-full flex-col gap-0.5 bg-card px-3 py-2.5 text-left active:bg-secondary/50",
                index > 0 && "border-t border-border",
              )}
            >
              <span className="truncate text-xs font-semibold">{row.primary}</span>
              {row.secondary && (
                <span className="truncate text-[11px] text-muted-foreground">{row.secondary}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-right text-[10px] text-muted-foreground">Places by Google</p>
    </div>
  );
}
