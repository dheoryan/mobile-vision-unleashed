import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_COMMIT_PX = 70;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function PostMediaLightbox({
  open,
  onClose,
  images,
  initialIndex = 0,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  /** Every photo on the post, in display order. A single entry works the
   *  same as before - the pager and dots just don't render for one image. */
  images: string[];
  initialIndex?: number;
  alt: string;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pageDragX, setPageDragX] = useState(0);
  const [paging, setPaging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastDistance = useRef<number | null>(null);
  const containerWidth = useRef(0);

  // Reset to whichever photo was tapped every time the lightbox reopens -
  // it shouldn't remember where a previous viewing session left off.
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const reset = () => {
    resetZoom();
    setPageDragX(0);
    pointers.current.clear();
    lastPoint.current = null;
    lastDistance.current = null;
  };

  const close = () => {
    reset();
    onClose();
  };

  const changeScale = (nextScale: number) => {
    const clamped = clampScale(nextScale);
    setScale(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  const distanceBetweenPointers = () => {
    const [first, second] = Array.from(pointers.current.values());
    return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastPoint.current = { x: event.clientX, y: event.clientY };
    lastDistance.current = distanceBetweenPointers();
    containerWidth.current = event.currentTarget.clientWidth;
    if (scale === 1 && images.length > 1) setPaging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      setPaging(false);
      const distance = distanceBetweenPointers();
      if (distance && lastDistance.current) {
        changeScale(scale * (distance / lastDistance.current));
      }
      lastDistance.current = distance;
      return;
    }

    if (!lastPoint.current) return;
    const dx = event.clientX - lastPoint.current.x;
    const dy = event.clientY - lastPoint.current.y;

    if (scale > 1) {
      setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
    } else if (paging) {
      setPageDragX((current) => {
        const next = current + dx;
        // Resist dragging past the first/last photo instead of a hard stop -
        // the same "it moves, but reluctantly" cue every carousel uses to
        // say "there's nothing more this way" without a jarring wall.
        const atStart = index === 0 && next > 0;
        const atEnd = index === images.length - 1 && next < 0;
        return atStart || atEnd ? current + dx * 0.35 : next;
      });
    }
    lastPoint.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const remaining = Array.from(pointers.current.values())[0] ?? null;
    lastPoint.current = remaining;
    lastDistance.current = distanceBetweenPointers();

    if (pointers.current.size === 0 && paging) {
      setPaging(false);
      const width = containerWidth.current || 1;
      const committed =
        Math.abs(pageDragX) > Math.min(SWIPE_COMMIT_PX, width * 0.2) && pointers.current.size === 0;
      if (committed) {
        if (pageDragX < 0 && index < images.length - 1) setIndex((i) => i + 1);
        else if (pageDragX > 0 && index > 0) setIndex((i) => i - 1);
      }
      setPageDragX(0);
      resetZoom();
    }
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    changeScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  };

  const goTo = (next: number) => {
    setIndex(Math.min(Math.max(next, 0), images.length - 1));
    resetZoom();
    setPageDragX(0);
  };

  // The track is `images.length * 100%` wide, so a percentage transform on
  // it resolves against that full width, not one photo's width - moving by
  // a flat `-100%` per index would skip an extra photo on every page past
  // the first (index 0's `-0%` happened to look right regardless, which is
  // exactly how this stayed hidden). One photo's share of the track is
  // `100 / images.length`; scale both the index step and the drag offset
  // (also a fraction of the track once expressed in the same %) by that.
  const slideUnit = images.length ? 100 / images.length : 100;

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
      title="Post photo"
      contentClassName="h-[100dvh] max-w-none overflow-hidden rounded-none border-0 bg-black sm:rounded-none"
      zIndex={80}
    >
      <div className="relative h-full w-full overflow-hidden bg-black">
        <div
          data-lightbox-gesture-surface
          className="absolute inset-0 flex touch-none select-none overflow-hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onWheel={onWheel}
          onDoubleClick={() => changeScale(scale > 1 ? 1 : 2.5)}
          style={{
            transform: `translate3d(${slideUnit * (-index + (containerWidth.current ? pageDragX / containerWidth.current : 0))}%, 0, 0)`,
            transition: paging ? "none" : "transform 220ms ease-out",
            width: `${images.length * 100}%`,
          }}
        >
          {images.map((src, i) => (
            <div
              key={src}
              className="flex h-full items-center justify-center"
              style={{ width: `${100 / images.length}%` }}
            >
              <img
                src={src}
                alt={i === index ? alt : ""}
                draggable={false}
                className="max-h-full max-w-full object-contain will-change-transform"
                style={
                  i === index
                    ? {
                        transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>

        <div
          data-lightbox-controls="top"
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-3 pb-10 pt-[max(12px,env(safe-area-inset-top))]"
        >
          {images.length > 1 ? (
            <p className="rounded-full bg-black/45 px-3 py-1.5 text-xs tabular-nums text-white/80">
              {index + 1} / {images.length}
            </p>
          ) : (
            <p className="rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/80">
              Pinch or double-tap to zoom
            </p>
          )}
          <button
            type="button"
            onClick={close}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close photo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center gap-1.5">
            {images.map((src, i) => (
              <span
                key={src}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/35",
                )}
              />
            ))}
          </div>
        )}

        <div
          data-lightbox-controls="bottom"
          className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/70 p-1 text-white backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => changeScale(scale - 0.5)}
            disabled={scale <= MIN_SCALE}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-14 text-center text-xs font-semibold tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => changeScale(scale + 0.5)}
            disabled={scale >= MAX_SCALE}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
              scale === 1 && offset.x === 0 && offset.y === 0 && "opacity-35",
            )}
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {images.length > 1 && index > 0 && (
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
          >
            ‹
          </button>
        )}
        {images.length > 1 && index < images.length - 1 && (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
          >
            ›
          </button>
        )}
      </div>
    </AnimatedModal>
  );
}
