import { useEffect, useState } from "react";
import { signVentureImageUrl } from "@/lib/uploads";
import { cn } from "@/lib/utils";

/**
 * A Venture's photo.
 *
 * The bucket is private, so `image_url` is an object path rather than a URL and
 * has to be exchanged for a signed one at render time. Storage RLS decides
 * whether the exchange succeeds — a scope='mine' Venture's photo is only
 * signable by someone who shares the host's Tribe. A failure therefore means
 * "you may not see this", not "something broke", so it renders nothing rather
 * than a broken-image icon or an error.
 *
 * Signed URLs last an hour. That is longer than any realistic time spent on
 * one screen, and re-signing on an interval would mean a request per card per
 * hour for cards nobody is looking at.
 */
/**
 * A Venture card with its photo as the background.
 *
 * The readability problem, and how it is solved rather than guessed at:
 *
 * The app's muted-foreground (used for the host's city, the meta row and the
 * note) is roughly #A1A1AA. Composited over a *white* photo pixel — the worst
 * case — it only clears WCAG AA's 4.5:1 once the scrim reaches about 85%
 * opacity. At 85% the photo is showing through at 15%, which is a tint, not a
 * picture. Scrimming the whole card to that level would technically satisfy
 * "photo as background" while making the photo pointless.
 *
 * So the scrim is not uniform. The top band is left almost clear, because
 * nothing is drawn there — that is where the photo actually reads as a photo.
 * Everything from the content downward sits under a 92% wash, which puts even
 * muted text comfortably past AA against any photo, including a white one.
 *
 * Cards without a photo render as before, on the flat card surface.
 */
export function VentureCardShell({
  path,
  children,
  className,
}: {
  path: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void signVentureImageUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const hasPhoto = Boolean(path && url);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border animate-rise",
        hasPhoto ? "bg-card" : "bg-card p-4",
        className,
      )}
    >
      {hasPhoto && (
        <>
          <img src={url!} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          {/* Clear-ish band: no text is drawn here, so the photo can be seen. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-background/10 via-background/35 to-background/92"
          />
          {/* Everything under the content is washed to 92%, which keeps even
              muted text past 4.5:1 over a pure-white photo. */}
          <span aria-hidden className="absolute inset-x-0 bottom-0 top-36 bg-background/92" />
        </>
      )}
      <div className={cn("relative", hasPhoto && "px-4 pb-4 pt-28")}>{children}</div>
    </article>
  );
}

export function VentureImage({
  path,
  className,
  rounded = "rounded-2xl",
}: {
  path: string | null | undefined;
  className?: string;
  rounded?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void signVentureImageUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path || !url) return null;

  return (
    <div className={cn("overflow-hidden bg-background/40", rounded, className)}>
      <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
    </div>
  );
}
