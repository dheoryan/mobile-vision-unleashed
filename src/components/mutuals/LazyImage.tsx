import { useState, type CSSProperties, type SyntheticEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Off-screen images (a feed with dozens of photos, Today's Five, a Venture
 * board) used to hit the network the moment they mounted and pop in with no
 * warning the instant bytes arrived - a blank tile, then a flash. `loading`
 * defers the fetch until the browser expects the image to scroll into view;
 * the shimmer + fade covers the gap between that fetch starting and the
 * image actually being decoded, so the space it will occupy is never empty.
 */
export function LazyImage({
  src,
  alt,
  className,
  wrapperClassName,
  draggable = false,
  onClick,
  style,
  eager = false,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Sizing/positioning for the shimmer placeholder - give this whatever
   *  the caller's layout needs (aspect ratio, min-height, absolute inset). */
  wrapperClassName?: string;
  draggable?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  /** The photo the viewer just tapped to open full-screen shouldn't wait on
   *  the lazy-load heuristic - it's already the thing they want to see. */
  eager?: boolean;
  /** Caller-owned fallback (e.g. swap to an emoji avatar). The element still
   *  unmounts itself internally so a broken image never sits there mid-fade. */
  onError?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", !loaded && "shimmer", wrapperClassName)}>
      {!failed && (
        <img
          src={src}
          alt={alt}
          draggable={draggable}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={(event: SyntheticEvent<HTMLImageElement>) => {
            setFailed(true);
            event.currentTarget.onerror = null;
            onError?.();
          }}
          onClick={onClick}
          style={style}
          className={cn(
            "transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            className,
          )}
        />
      )}
    </div>
  );
}
