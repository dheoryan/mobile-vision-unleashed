import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { PROFILE_OPTION_ICONS } from "@/lib/profile-option-icons";
import { interestOptionForVibe } from "@/lib/profile-options";
import { cn } from "@/lib/utils";

export function VentureVibeLabel({
  value,
  iconClassName,
}: {
  value: string;
  iconClassName?: string;
}) {
  const option = interestOptionForVibe(value);
  const Icon = option ? PROFILE_OPTION_ICONS[option.id] : SparkleIcon;

  return (
    <>
      <Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} />
      <span>{option?.label ?? value}</span>
    </>
  );
}
