import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DotsSixVerticalIcon } from "@phosphor-icons/react/dist/csr/DotsSixVertical";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { cn } from "@/lib/utils";

export type ComposedImage = { path: string; previewUrl: string };

const SLOT = 88; // thumbnail (80px) + gap (8px), used to translate a drag offset into slots

/**
 * A horizontally-scrollable strip of photo thumbnails with press-and-drag
 * reordering. Native HTML5 drag-and-drop was the obvious first choice but
 * it's a mouse-era API with poor-to-nonexistent touch support, and every
 * screen this composer runs on is a phone - so this tracks pointer
 * position directly instead, moving the dragged thumbnail past a
 * neighbor's midpoint to swap, the same technique most sortable-list
 * libraries use under the hood for a single axis.
 */
export function ImageStrip({
  images,
  onReorder,
  onRemove,
  onAddMore,
  canAddMore,
  uploading,
}: {
  images: ComposedImage[];
  onReorder: (next: ComposedImage[]) => void;
  onRemove: (index: number) => void;
  onAddMore: () => void;
  canAddMore: boolean;
  uploading: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);
  const orderRef = useRef(images);
  orderRef.current = images;

  const startDrag = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (images.length < 2) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragIndex(index);
    startX.current = event.clientX;
    setDragX(0);
  };

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragIndex === null) return;
    const delta = event.clientX - startX.current;
    setDragX(delta);

    const slots = Math.round(delta / SLOT);
    if (slots === 0) return;
    const targetIndex = Math.min(Math.max(dragIndex + slots, 0), orderRef.current.length - 1);
    if (targetIndex === dragIndex) return;

    const next = orderRef.current.slice();
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(next);
    setDragIndex(targetIndex);
    startX.current = event.clientX;
    setDragX(0);
  };

  const endDrag = () => {
    setDragIndex(null);
    setDragX(0);
  };

  return (
    <div className="scroll-panel -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
      {images.map((img, i) => (
        <div
          key={img.path}
          onPointerDown={startDrag(i)}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "relative h-20 w-20 shrink-0 touch-none select-none overflow-hidden rounded-xl border border-border",
            dragIndex === i && "z-10 shadow-lg",
          )}
          style={{
            transform: dragIndex === i ? `translateX(${dragX}px) scale(1.04)` : undefined,
            transition: dragIndex === i ? "none" : "transform 150ms ease-out",
          }}
        >
          <img
            src={img.previewUrl}
            alt={`Attached photo ${i + 1}`}
            draggable={false}
            className="h-full w-full object-cover"
          />
          {i === 0 && (
            <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">
              Cover
            </span>
          )}
          {images.length > 1 && (
            <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white/80">
              <DotsSixVerticalIcon className="h-3 w-3" />
            </span>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(i)}
            aria-label={`Remove photo ${i + 1}`}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
      {canAddMore && (
        <button
          type="button"
          onClick={onAddMore}
          disabled={uploading}
          aria-label="Add photo"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        >
          {uploading ? (
            <SpinnerGapIcon className="h-5 w-5 animate-spin" />
          ) : (
            <ImageIcon className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}
