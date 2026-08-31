import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GENDER_OPTIONS, type GenderId } from "@/lib/profile-options";

/**
 * A dedicated single-select control for gender, not a reuse of the
 * multi-select `ChoiceGroup` pill grid used in Onboarding for interests/
 * social intents/availability - that component always renders an icon per
 * option (falling back to a checkmark for anything without a custom one,
 * which gender doesn't have) regardless of selection state, so every
 * option read as "checked". This is a plain radio-style row instead
 * (exactly one always selected, never zero), but shares the same pill
 * shape/sizing/checkmark language as `ProfileChoiceGroup` (the Interests/
 * Here for/Usually free groups right below it in Edit profile) - its
 * checkmark is genuinely conditional on `active`, so it doesn't have the
 * Onboarding component's bug, and matching it keeps every option group in
 * that form looking like one consistent design instead of two.
 */
export function GenderSelect({
  value,
  onChange,
  hint,
  /** Once a value has been saved, it's permanent - enforced for real by the
   *  `enforce_gender_immutable_before_update` trigger, not just this prop.
   *  Disabling the control here is purely so the person isn't invited to
   *  pick a different option only to have the save silently no-op the field. */
  locked = false,
  /** Matches `ProfileChoiceGroup`'s `accentColor` convention right below this
   *  control in Edit profile, so the selected pill reads as "your Tribe,"
   *  not a generic app color. Defaults to the app primary for call sites
   *  (Onboarding, before a Tribe carries the same meaning yet) that don't
   *  pass one. */
  accentColor = "var(--primary)",
}: {
  value: GenderId | null;
  onChange: (id: GenderId) => void;
  hint?: string;
  locked?: boolean;
  accentColor?: string;
}) {
  return (
    <fieldset disabled={locked}>
      <div className="flex items-center justify-between gap-3">
        <legend className="font-display text-sm font-bold text-foreground">Gender</legend>
        {hint && !locked && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-2 flex gap-2">
        {GENDER_OPTIONS.map((option) => {
          const active = value === option.id;
          return (
            <button
              type="button"
              key={option.id}
              role="radio"
              aria-checked={active}
              disabled={locked}
              onClick={() => onChange(option.id)}
              className={cn(
                "min-h-10 flex-1 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "text-foreground"
                  : "border-transparent bg-secondary text-foreground hover:bg-secondary/70",
                locked && "cursor-not-allowed opacity-60 hover:bg-secondary",
              )}
              style={
                active
                  ? {
                      borderColor: accentColor,
                      backgroundColor: `color-mix(in oklab, ${accentColor} 26%, var(--card))`,
                    }
                  : undefined
              }
            >
              {active && <Check className="mr-1 inline h-3 w-3" style={{ color: accentColor }} />}
              {option.label}
            </button>
          );
        })}
      </div>
      {locked && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> Can't be changed once set
        </p>
      )}
    </fieldset>
  );
}
