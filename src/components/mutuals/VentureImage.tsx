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
