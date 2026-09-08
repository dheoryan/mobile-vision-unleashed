import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { PencilLineIcon } from "@phosphor-icons/react/dist/csr/PencilLine";
import { SealCheckIcon } from "@phosphor-icons/react/dist/csr/SealCheck";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { resolvePlace, searchPlaces, type PlaceSuggestion } from "@/lib/places.functions";
import { GOOGLE_PLACES_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

/**
 * Picking where a Venture happens.
 *
 * ---------- the session token ----------
 *
 * One token spans the whole interaction: every keystroke, and the single
 * details call that ends it. With Essentials details, the first 12 autocomplete
 * requests use the Autocomplete Requests SKU; later requests in that session
 * have no charge. Monthly free caps apply separately. The token is
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
  gradient,
  accentColor,
}: {
  value: PickedVenue | null;
  onChange: (venue: PickedVenue | null) => void;
  viewerLat?: number;
  viewerLng?: number;
  /** Same gradient (all Tribes) vs. Tribe-color (Tribe-only) rule as the
   *  rest of the Venture create/edit form - passed down so this picker's
   *  own confirm buttons don't stay the odd plain-primary one out. */
  gradient?: boolean;
  accentColor?: string;
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
  const [searched, setSearched] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectionVersion = useRef(0);
  const selectionPending = useRef(false);
  const searchVersion = useRef(0);

  useEffect(
    () => () => {
      selectionVersion.current += 1;
    },
    [],
  );

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
    if (!GOOGLE_PLACES_ENABLED || stage !== "search" || value || selectionPending.current) {
      setSearching(false);
      return;
    }
    const q = query.trim();
    setResults([]);
    setSearched(false);
    setError(null);
    if (q.length < 2) {
      setSearching(false);
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const version = ++searchVersion.current;
    setSearching(true);
    const timer = setTimeout(() => {
      if (version !== searchVersion.current) return;
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
          if (cancelled || version !== searchVersion.current) return;
          setResults(rows);
          setSearched(true);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled || version !== searchVersion.current) return;
          setResults([]);
          setError((err as Error).message);
        })
        .finally(() => !cancelled && version === searchVersion.current && setSearching(false));
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, search, viewerLat, viewerLng, stage, value]);

  const pick = async (suggestion: PlaceSuggestion) => {
    if (selectionPending.current) return;
    selectionPending.current = true;
    searchVersion.current += 1;
    const version = ++selectionVersion.current;
    setResolvingId(suggestion.place_id);
    setSearching(false);
    setError(null);
    try {
      const detail = await resolve({
        data: { place_id: suggestion.place_id, session_token: tokenRef.current },
      });
      if (version !== selectionVersion.current) return;
      setChosen({
        place_id: detail.place_id,
        suggestion: suggestion.primary,
        area: suggestion.secondary,
        latitude: detail.latitude,
        longitude: detail.longitude,
      });
      // Preserve the host's own draft; provider labels stay display-only.
      setStage("label");
    } catch (err) {
      if (version === selectionVersion.current) {
        setError(
          err instanceof Error ? err.message : "Could not select this place. Please try again.",
        );
      }
    } finally {
      if (version === selectionVersion.current) {
        tokenRef.current = crypto.randomUUID();
        selectionPending.current = false;
        setResolvingId(null);
      }
    }
  };

  /**
   * Return from optional Google search to the primary manual path.
   *
   * Whatever is in the search box carries over as a starting point, because if
   * someone has typed "Bloo" and given up, that is still what they call it.
   */
  const useFreeText = () => {
    selectionVersion.current += 1;
    selectionPending.current = false;
    setResolvingId(null);
    setError(null);
    tokenRef.current = crypto.randomUUID();
    setChosen(null);
    if (!label.trim() && query.trim()) setLabel(query.trim());
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
        <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{value.host_label}</span>
            {value.google_place_id && (
              <SealCheckIcon
                className="h-3.5 w-3.5 shrink-0 text-accent-readable"
                aria-label="Place found on Google Maps"
              />
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{value.area}</p>
          {!value.google_place_id && (
            <p className="mt-0.5 text-xs text-muted-foreground">Host-named place · map optional</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setLabel(value.host_label);
            setArea(value.area);
            setStage("manual");
            setQuery("");
            setResults([]);
            setChosen(null);
          }}
          aria-label="Change venue"
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (stage === "manual") {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setQuery(label.trim());
            setResults([]);
            setError(null);
            setStage("search");
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold transition-colors hover:border-primary/50 hover:text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MapPinIcon className="h-4 w-4" />
          Choose a location
        </button>
        <p className="text-center text-xs text-muted-foreground">
          {GOOGLE_PLACES_ENABLED
            ? "Search places with Google Maps"
            : "Google Maps search coming soon"}
        </p>

        <div className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
          <PencilLineIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold">Name the place your way</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
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
          <span className="text-xs leading-relaxed text-muted-foreground">
            This is what people use to decide whether the trip works for them.
          </span>
        </label>

        <button
          type="button"
          onClick={confirmManual}
          disabled={!ready}
          className={cn(
            "rounded-xl py-2.5 text-xs font-semibold transition-[transform,filter] active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
            gradient || accentColor
              ? "text-white"
              : "bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
            gradient && "bg-meutuals-gradient hover:brightness-110",
          )}
          style={!gradient && accentColor ? { backgroundColor: accentColor } : undefined}
        >
          Use this place
        </button>
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
            <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{chosen.suggestion}</p>
              {chosen.area && (
                <p className="truncate text-xs text-muted-foreground">{chosen.area}</p>
              )}
              <p className="mt-2 text-xs font-normal text-white" translate="no">
                Google Maps
              </p>
            </div>
          </div>
        )}

        {!chosen.place_id && (
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-border p-3">
            <PencilLineIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
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
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add the neighborhood and city you want people to see on the Venture board.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStage("search");
              setChosen(null);
            }}
            className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Back
          </button>
          <button
            type="button"
            onClick={confirmGoogle}
            disabled={!ready}
            className={cn(
              "flex-[1.4] rounded-xl py-2.5 text-xs font-semibold transition-[transform,filter] active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
              gradient || accentColor
                ? "text-white"
                : "bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
              gradient && "bg-meutuals-gradient hover:brightness-110",
            )}
            style={!gradient && accentColor ? { backgroundColor: accentColor } : undefined}
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
          <p className="text-xs font-semibold">Choose a location</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Find a café, park, or another place to meet.
          </p>
        </div>
        <button
          type="button"
          onClick={useFreeText}
          className="min-h-9 shrink-0 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Enter manually
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus={GOOGLE_PLACES_ENABLED}
          disabled={!GOOGLE_PLACES_ENABLED || resolvingId !== null}
          aria-label="Search Google Maps places"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 120))}
          placeholder="Café, bar, park…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {(searching || resolvingId) && (
          <SpinnerGapIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>

      {GOOGLE_PLACES_ENABLED && !error && (
        <p
          className="px-1 text-xs leading-relaxed text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {resolvingId
            ? "Getting this place’s map pin…"
            : searching
              ? "Searching places…"
              : query.trim().length < 2
                ? "Type at least 2 characters. Add a city to narrow your search."
                : searched && results.length === 0
                  ? "No places found. Try adding the city, or enter the place manually."
                  : null}
        </p>
      )}

      {!GOOGLE_PLACES_ENABLED && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4" role="status">
          <p className="text-sm font-semibold">Google Maps search is coming soon</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            For now, choose Enter manually to add the place name and area. Your Venture can still be
            created without a map pin.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive"
        >
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          {results.map((row, index) => (
            <button
              key={row.place_id}
              type="button"
              disabled={resolvingId !== null}
              onClick={() => void pick(row)}
              className={cn(
                "flex min-h-12 w-full flex-col gap-1 bg-card px-3 py-3 text-left transition-colors hover:bg-secondary/30 active:bg-secondary/50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                index > 0 && "border-t border-border",
              )}
            >
              <span className="text-sm font-semibold">{row.primary}</span>
              {row.secondary && (
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {row.secondary}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {GOOGLE_PLACES_ENABLED && (
        <p className="text-right text-xs font-normal text-white" translate="no">
          Google Maps
        </p>
      )}
    </div>
  );
}
