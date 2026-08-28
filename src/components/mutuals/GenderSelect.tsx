import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GENDER_OPTIONS, type GenderId } from "@/lib/profile-options";

/**
 * A dedicated single-select control for gender, not a reuse of the
 * multi-select `ChoiceGroup` pill grid used for interests/social intents/
 * availability. That component always renders an icon per option (falling
 * back to a checkmark for anything without a custom one, which gender
 * doesn't have) regardless of selection state, so every option reads as
 * "checked" - and a checkbox grid is the wrong shape for an exactly-one
 * choice in the first place. This is a plain radio-style segmented row.
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
}: {
  value: GenderId | null;
  onChange: (id: GenderId) => void;
  hint?: string;
  locked?: boolean;
}) {
  return (
    <fieldset disabled={locked}>
      <div className="flex items-center justify-between gap-3">
        <legend className="label-mono text-muted-foreground">Gender</legend>
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
                "min-h-11 flex-1 rounded-xl border px-3 text-xs font-semibold transition-colors active:scale-[0.98] disabled:active:scale-100",
                active
                  ? "border-primary bg-primary/15 text-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                locked &&
                  "cursor-not-allowed opacity-60 hover:border-border hover:text-muted-foreground",
              )}
            >
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
