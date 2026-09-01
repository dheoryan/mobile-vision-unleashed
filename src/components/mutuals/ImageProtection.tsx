import { useEffect } from "react";

/**
 * Blocks the desktop right-click "Save image as…" context menu on every
 * `<img>` in the app - post photos, comment photos, profile pictures. One
 * listener at the document root rather than an onContextMenu prop on every
 * image render site, so new image surfaces get this for free.
 *
 * The CSS in styles.css handles the mobile equivalent (iOS long-press
 * "Save Photo" callout) and drag-to-desktop; this only needs to cover the
 * one thing CSS can't - a real click event to preventDefault.
 */
export function ImageProtection() {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return null;
}
