import { Slider } from "@/components/ui/slider";
import { LOCATION_RADII, type LocationRadiusKm } from "@/lib/location";
import { cn } from "@/lib/utils";

export function DiscoveryRadiusSlider({
  value,
  onChange,
  disabled = false,
}: {
  value: LocationRadiusKm;
  onChange: (value: LocationRadiusKm) => void;
  disabled?: boolean;
}) {
  const index = LOCATION_RADII.indexOf(value);

  return (
    <div className="rounded-2xl border border-border bg-background/70 px-4 pb-3 pt-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-mono text-muted-foreground">Discovery radius</p>
          <p className="mt-1 text-xs text-muted-foreground">The maximum distance for mutual matches.</p>
        </div>
        <output className="shrink-0 font-display text-xl font-bold text-primary" aria-live="polite">{value} km</output>
      </div>
      <Slider
        className="mt-5"
        min={0}
        max={LOCATION_RADII.length - 1}
        step={1}
        value={[index < 0 ? 1 : index]}
        disabled={disabled}
        aria-label="Discovery radius"
        onValueChange={([nextIndex]) => onChange(LOCATION_RADII[nextIndex] ?? 15)}
      />
      <div className="mt-3 grid grid-cols-3 text-[10px] font-semibold" aria-hidden>
        {LOCATION_RADII.map((radius, radiusIndex) => (
          <span key={radius} className={cn(radiusIndex === 0 && "text-left", radiusIndex === 1 && "text-center", radiusIndex === 2 && "text-right", value === radius ? "text-primary" : "text-muted-foreground")}>
            {radius === 5 ? "Close · 5 km" : radius === 15 ? "Local · 15 km" : "Wide · 50 km"}
          </span>
        ))}
      </div>
    </div>
  );
}

