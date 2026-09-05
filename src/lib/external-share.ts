export type ShareChannel = "native" | "clipboard";

/** Only a completed browser action may be recorded. Opening/dismissing the
 * picker and missing/failed clipboard access never report success. */
export async function performExternalShare(
  url: string,
  browser: {
    share?: (data: { url: string }) => Promise<void>;
    copy?: (url: string) => Promise<void>;
  },
): Promise<ShareChannel | null> {
  if (browser.share) {
    try {
      await browser.share({ url });
      return "native";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return null;
    }
  }
  if (!browser.copy)
    throw new Error("Sharing is unavailable. Copy the page address to share this post.");
  await browser.copy(url);
  return "clipboard";
}
