import { useEffect, useState } from "react";
import { signVentureImageUrl } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { LazyImage } from "./LazyImage";

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
 * A Venture card: fixed-height photo header, then content on the card surface.
 *
 * The first attempt stretched the photo behind the *whole* card under a heavy
 * wash. Two things were wrong with it, both visible the moment a real card had
 * real content in it:
 *
 *   1. Cards are not a fixed height. A hosted card grows with its applicant
 *      list and grows again when the edit form opens, so `object-cover` over
 *      the full card meant the crop moved depending on how many people had
 *      applied. The subject of the photo drifted out of frame.
 *
 *   2. The wash needed to be ~92% for muted text to clear WCAG AA over a white
 *      photo pixel. Applied across the whole card that is not a background, it
 *      is a smear — and it sat behind sections like "Pending requests" that
 *      have nothing to do with the photo, making them look dirty rather than
 *      designed.
 *
 * A fixed 176px media header fixes both. The crop is predictable because the
 * height is constant. The photo is fully visible at the top, where nothing is
 * drawn over it. Only the title block sits on the image, over a bottom-anchored
 * gradient that reaches full opacity exactly where the text is. Everything
 * below runs on the normal card surface, clean.
 *
 * Passing the header in as a prop rather than as part of `children` is what
 * makes the Look and Host cards identical: both hand over the same
 * VentureCardHeader and get the same treatment, photo or not.
 */
export function VentureCardShell({
  path,
  header,
  children,
  className,
}: {
  path: string | null | undefined;
  /** Title block. Rendered over the photo when there is one. */
  header?: React.ReactNode;
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
  // The signed URL is a round trip on its own, separate from the image
  // bytes - without this branch the card rendered as if there were no
  // photo at all until that resolved, then popped the whole media header in,
  // shifting the header text with it. Keeping the same 44-height block in a
  // shimmer state means only the photo itself fades in later.
  const resolvingPhoto = Boolean(path) && !url;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card animate-rise",
        className,
      )}
    >
      {hasPhoto ? (
        <div className="relative h-44 w-full">
          <LazyImage
            src={url!}
            alt=""
            eager
            wrapperClassName="absolute inset-0 h-full w-full"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Anchored to the bottom, so it is fully opaque exactly where the
              text sits and clear at the top where the photo should be seen. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-card via-card/75 to-transparent"
          />
          {header && <div className="absolute inset-x-0 bottom-0 px-4 pb-3">{header}</div>}
        </div>
      ) : resolvingPhoto ? (
        <div className="shimmer relative h-44 w-full">
          {header && <div className="absolute inset-x-0 bottom-0 px-4 pb-3">{header}</div>}
        </div>
      ) : (
        header && <div className="px-4 pt-4">{header}</div>
      )}
      <div className={cn("px-4 pb-4", hasPhoto || resolvingPhoto ? "pt-3" : "pt-2")}>
        {children}
      </div>
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

  if (!path) return null;

  if (!url) {
    return <div className={cn("shimmer bg-background/40", rounded, className)} />;
  }

  return (
    <div className={cn("overflow-hidden bg-background/40", rounded, className)}>
      <LazyImage
        src={url}
        alt=""
        wrapperClassName="h-full w-full"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
