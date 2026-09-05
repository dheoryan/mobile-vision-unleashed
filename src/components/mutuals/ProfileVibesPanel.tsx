import { useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { cn } from "@/lib/utils";
import { readableAccentColor, tribeById, type TribeId } from "@/lib/mutuals-data";
import {
  INTEREST_OPTIONS,
  SOCIAL_INTENT_OPTIONS,
  optionLabel,
  primaryInterests,
  type InterestId,
  type SocialIntentId,
} from "@/lib/profile-options";
import { PROFILE_OPTION_ICONS } from "@/lib/profile-option-icons";

export function ProfileVibesPanel({
  tribeId,
  socialIntents,
  interests,
}: {
  tribeId: TribeId;
  socialIntents: ReadonlyArray<string>;
  interests: ReadonlyArray<string>;
}) {
  const tribe = tribeById(tribeId);
  const primaryIds = new Set(primaryInterests(tribeId).map((option) => option.id));
  const tribeEnergy = interests
    .filter((id) => primaryIds.has(id as InterestId))
    .map((id) => ({ id, label: optionLabel(INTEREST_OPTIONS, id as InterestId) }));
  const alsoInto = interests
    .filter((id) => !primaryIds.has(id as InterestId))
    .map((id) => ({ id, label: optionLabel(INTEREST_OPTIONS, id as InterestId) }));

  if (socialIntents.length === 0 && interests.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No Vibes added yet.
      </p>
    );
  }

  return (
    <section aria-label="Vibes">
      <p className="label-mono text-muted-foreground">Social signal</p>
      <div className="mt-3 space-y-4">
        {socialIntents.length > 0 && (
          <VibeGroup
            label="Here for"
            items={socialIntents.map((id) => ({
              id,
              label: optionLabel(SOCIAL_INTENT_OPTIONS, id as SocialIntentId),
            }))}
            accentColor={tribe.colorVar}
            variant="outline"
          />
        )}
        {tribeEnergy.length > 0 && (
          <VibeGroup
            label="Tribe energy"
            items={tribeEnergy}
            accentColor={tribe.colorVar}
            variant="tinted"
          />
        )}
        {alsoInto.length > 0 && <VibeGroup label="Also into" items={alsoInto} variant="neutral" />}
      </div>
    </section>
  );
}

function VibeGroup({
  label,
  items,
  accentColor,
  variant,
}: {
  label: string;
  items: Array<{ id: string; label: string }>;
  accentColor?: string;
  variant: "outline" | "tinted" | "neutral";
}) {
  const [expanded, setExpanded] = useState(false);
  const maxVisible = 2;
  const collapsible = items.length > maxVisible;
  const visible = expanded ? items : items.slice(0, maxVisible);
  const hiddenCount = items.length - visible.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="label-mono text-muted-foreground">{label}</p>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex min-h-11 items-center gap-1 px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {expanded ? "Show less" : `+${hiddenCount} more`}
            <CaretDownIcon
              aria-hidden
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
            />
          </button>
        ) : (
          <span
            className="label-mono text-muted-foreground"
            aria-label={`${items.length} selected`}
          >
            {items.length} picks
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        {visible.map((item) => (
          <VibeTag
            key={item.id}
            id={item.id}
            label={item.label}
            accentColor={accentColor}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

function VibeTag({
  id,
  label,
  accentColor,
  variant,
}: {
  id: string;
  label: string;
  accentColor?: string;
  variant: "outline" | "tinted" | "neutral";
}) {
  const Icon = PROFILE_OPTION_ICONS[id];
  const isNeutral = variant === "neutral" || !accentColor;

  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
        isNeutral && "border-white/10 bg-secondary text-foreground",
      )}
      style={
        !isNeutral
          ? {
              borderColor: `color-mix(in oklab, ${accentColor} ${variant === "outline" ? 65 : 48}%, transparent)`,
              backgroundColor:
                variant === "outline"
                  ? `color-mix(in oklab, ${accentColor} 8%, transparent)`
                  : `color-mix(in oklab, ${accentColor} 22%, var(--card))`,
              color: readableAccentColor(accentColor),
            }
          : undefined
      }
    >
      {Icon && <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" weight="bold" />}
      {label}
    </span>
  );
}
