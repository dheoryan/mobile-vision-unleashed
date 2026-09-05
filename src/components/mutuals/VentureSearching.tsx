import logoMark from "@/assets/logo-mark.webp";

/**
 * The waiting state for the Venture board.
 *
 * A generic spinner says "software is busy". This says "we are looking", which
 * is the actual thing happening and the thing the app is for. It reuses the
 * MEUTUALS eye as the emitter, so the loading state is a brand moment rather
 * than a gap in one — the screens people wait on are the screens they remember.
 *
 * Pure CSS (see .sonar-ring / .sonar-core in styles.css): the standing
 * decision is no JS animation library, and three staggered rings on one
 * keyframe set need none.
 */
export function VentureSearching({ label = "Looking for plans near you…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14" role="status" aria-live="polite">
      <div className="relative flex h-28 w-28 items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="sonar-ring absolute inset-0 rounded-full border border-primary/60"
            style={{ animationDelay: `${i * 0.8}s` }}
          />
        ))}
        <img
          src={logoMark}
          alt=""
          aria-hidden
          className="sonar-core relative h-12 w-12 object-contain"
        />
      </div>
      <p className="mt-4 text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">Ventures appear as people post them.</p>
    </div>
  );
}
