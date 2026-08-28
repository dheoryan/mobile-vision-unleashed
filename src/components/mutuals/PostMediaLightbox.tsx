import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { cn } from "@/lib/utils";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function PostMediaLightbox({
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
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastDistance = useRef<number | null>(null);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
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
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size >= 2) {
      const distance = distanceBetweenPointers();
      if (distance && lastDistance.current) {
        changeScale(scale * (distance / lastDistance.current));
      }
      lastDistance.current = distance;
      return;
    }

    if (scale > 1 && lastPoint.current) {
      setOffset((current) => ({
        x: current.x + event.clientX - lastPoint.current!.x,
        y: current.y + event.clientY - lastPoint.current!.y,
      }));
    }
    lastPoint.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const remaining = Array.from(pointers.current.values())[0] ?? null;
    lastPoint.current = remaining;
    lastDistance.current = distanceBetweenPointers();
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    changeScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  };

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
      <div
        className="relative flex h-full w-full touch-none select-none items-center justify-center overflow-hidden bg-black"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onWheel={onWheel}
        onDoubleClick={() => changeScale(scale > 1 ? 1 : 2.5)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain will-change-transform"
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
        />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-3 pb-10 pt-[max(12px,env(safe-area-inset-top))]">
          <p className="rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/80">
            Pinch or double-tap to zoom
          </p>
          <button
            type="button"
            onClick={close}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close photo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/70 p-1 text-white backdrop-blur-md">
          <button
            type="button"
            onClick={() => changeScale(scale - 0.5)}
            disabled={scale <= MIN_SCALE}
            className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-35"
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
            className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-35"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={reset}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full",
              scale === 1 && offset.x === 0 && offset.y === 0 && "opacity-35",
            )}
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
