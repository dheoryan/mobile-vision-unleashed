import { TRIBES, type TribeId } from "@/lib/mutuals-data";
import { cn } from "@/lib/utils";

export function TribeSwitcher({ active, onChange }: { active: TribeId; onChange: (id: TribeId) => void }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-3">
        {TRIBES.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95",
              )}
              style={{ ["--tribe-active" as string]: t.colorVar }}
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl",
                  isActive ? "ring-tribe" : "opacity-70"
                )}
                style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 22%, transparent)` }}
              >
                {t.emoji}
              </span>
              <span className={cn(
                "text-[11px] font-medium",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
