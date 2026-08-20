import { cn } from "@/lib/utils";

/**
 * Decorative editorial artwork for empty and educational states.
 *
 * Deliberately takes `src` rather than a name-keyed lookup: a barrel that
 * imported all nine illustrations would pull every asset into every route's
 * bundle. Each screen imports only the one it renders.
 *
 * The art is always decorative — adjacent copy carries the meaning, so `alt`
 * defaults to empty and the image is hidden from assistive tech. Never put an
 * instruction only in one of these.
 *
 * The assets are transparent WebP: the black card the artwork was generated on
 * has been keyed out, so the art sits directly on whatever surface is behind
 * it. That means no card, no border and no crop here — a frame around
 * already-transparent art just reintroduces the box we removed. `object-contain`
 * rather than `cover`, because with no background to bleed into, cropping just
 * cuts the composition.
 */
export function FeatureIllustration({
  src,
  size = "md",
  className,
  eager = false,
}: {
  src: string;
  /** sm ≈ onboarding chapter thumbnail, md ≈ empty state, lg ≈ full-width hero. */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Only for artwork above the fold on first paint (onboarding step 1). */
  eager?: boolean;
}) {
  const width = size === "sm" ? "w-[136px]" : size === "md" ? "w-[184px]" : "w-full max-w-[260px]";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "mx-auto",
        // Reserve the box before the image decodes so nothing shifts.
        "aspect-[3/4]",
        width,
        "animate-in fade-in-0 duration-300 motion-reduce:animate-none",
        className,
      )}
    >
      <img
        src={src}
        alt=""
        width={600}
        height={800}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
