import { useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CampfireIcon } from "@phosphor-icons/react/dist/csr/Campfire";
import { PlanetIcon } from "@phosphor-icons/react/dist/csr/Planet";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
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
import { TribeMark } from "./TribeMark";

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
  const totalPicks = socialIntents.length + interests.length;
  const groupCount = [socialIntents.length, tribeEnergy.length, alsoInto.length].filter(
    Boolean,
  ).length;

  if (totalPicks === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No Vibes added yet.
      </p>
    );
  }

  return (
    <section aria-label="Vibes" className="pb-2">
      <div
        className="relative -mx-5 overflow-hidden border-y border-border px-5 py-5"
        style={{
          background: `linear-gradient(100deg, color-mix(in oklab, ${tribe.colorVar} 13%, transparent) 0%, transparent 72%)`,
        }}
      >
        <SparkleIcon
          aria-hidden
          className="pointer-events-none absolute -right-5 -top-8 h-32 w-32 opacity-[0.055]"
          weight="fill"
        />
        <div className="relative flex items-center gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
            style={{
              borderColor: `color-mix(in oklab, ${tribe.colorVar} 52%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 15%, transparent)`,
              color: readableAccentColor(tribe.colorVar),
            }}
          >
            <TribeMark tribe={tribe} size="sm" />
          </span>
          <div className="min-w-0">
            <p className="label-mono" style={{ color: readableAccentColor(tribe.colorVar) }}>
              Vibe map
            </p>
            <h2 className="mt-0.5 font-display text-lg font-bold">The mix</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalPicks} picks across {groupCount} {groupCount === 1 ? "layer" : "layers"}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {socialIntents.length > 0 && (
          <VibeGroup
            label="Here for"
            supportingCopy="Connections and social energy"
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
            supportingCopy={`${tribe.name} favorites`}
            items={tribeEnergy}
            accentColor={tribe.colorVar}
            variant="tinted"
          />
        )}
        {alsoInto.length > 0 && (
          <VibeGroup
            label="Also into"
            supportingCopy="Interests beyond the Tribe"
            items={alsoInto}
            variant="neutral"
          />
        )}
      </div>
    </section>
  );
}

function VibeGroup({
  label,
  supportingCopy,
  items,
  accentColor,
  variant,
}: {
  label: string;
  supportingCopy: string;
  items: Array<{ id: string; label: string }>;
  accentColor?: string;
  variant: "outline" | "tinted" | "neutral";
}) {
  const [expanded, setExpanded] = useState(false);
  const maxVisible = 4;
  const collapsible = items.length > maxVisible;
  const visible = expanded ? items : items.slice(0, maxVisible);
  const GroupIcon =
    variant === "outline" ? UsersThreeIcon : variant === "tinted" ? CampfireIcon : PlanetIcon;

  const heading = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
          variant === "neutral" && "border-white/10 bg-secondary text-foreground",
        )}
        style={
          variant !== "neutral" && accentColor
            ? {
                borderColor: `color-mix(in oklab, ${accentColor} 42%, transparent)`,
                backgroundColor: `color-mix(in oklab, ${accentColor} 12%, transparent)`,
                color: readableAccentColor(accentColor),
              }
            : undefined
        }
      >
        <GroupIcon aria-hidden className="h-4 w-4" weight="bold" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{supportingCopy}</span>
      </span>
      <span className="label-mono shrink-0 text-muted-foreground">{items.length}</span>
      {collapsible && (
        <CaretDownIcon
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      )}
    </>
  );

  return (
    <div className="py-5">
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {heading}
        </button>
      ) : (
        <div className="flex min-h-11 items-center gap-3">{heading}</div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
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
      {collapsible && !expanded && (
        <p className="mt-2 text-xs text-muted-foreground">Tap the row to see all.</p>
      )}
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
