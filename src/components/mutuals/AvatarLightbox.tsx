import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatedModal } from "@/components/ui/animated-modal";

/**
 * Instagram-style profile photo viewer: full-screen black backdrop, the
 * photo shown large and circular (not the rectangular pinch-zoom treatment
 * PostMediaLightbox gives a post image - a profile picture is a portrait,
 * not something people zoom or pan around). Tap anywhere, including the
 * photo itself, to dismiss - the explicit close button is there for
 * discoverability, not because the tap-anywhere behavior needs it.
 */
export function AvatarLightbox({
  open,
  onClose,
  src,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
}) {
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Profile photo"
      contentClassName="h-[100dvh] max-w-none overflow-hidden rounded-none border-0 bg-black sm:rounded-none"
      zIndex={80}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      >
        <span className="aspect-square w-[min(82vw,420px)] overflow-hidden rounded-full ring-1 ring-white/10">
          <img src={src} alt={alt} draggable={false} className="h-full w-full object-cover" />
        </span>
      </button>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close photo"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
    </AnimatedModal>
  );
}
