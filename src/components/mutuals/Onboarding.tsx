import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FeatureIllustration } from "./FeatureIllustration";
import welcomeArt from "@/assets/app-illustrations/onboarding-01.webp";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { CrosshairIcon } from "@phosphor-icons/react/dist/csr/Crosshair";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { TreeIcon } from "@phosphor-icons/react/dist/csr/Tree";
import { BarbellIcon } from "@phosphor-icons/react/dist/csr/Barbell";
import { BookOpenIcon } from "@phosphor-icons/react/dist/csr/BookOpen";
import { MusicNoteIcon } from "@phosphor-icons/react/dist/csr/MusicNote";
import { PaletteIcon } from "@phosphor-icons/react/dist/csr/Palette";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/csr/ForkKnife";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { MoonStarsIcon } from "@phosphor-icons/react/dist/csr/MoonStars";
import { CpuIcon } from "@phosphor-icons/react/dist/csr/Cpu";
import { BriefcaseIcon } from "@phosphor-icons/react/dist/csr/Briefcase";
import { HeartbeatIcon } from "@phosphor-icons/react/dist/csr/Heartbeat";
import { GameControllerIcon } from "@phosphor-icons/react/dist/csr/GameController";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { PulseIcon } from "@phosphor-icons/react/dist/csr/Pulse";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { CompassIcon } from "@phosphor-icons/react/dist/csr/Compass";
import { NetworkIcon } from "@phosphor-icons/react/dist/csr/Network";
import { LightbulbIcon } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import { SunHorizonIcon } from "@phosphor-icons/react/dist/csr/SunHorizon";
import { CalendarIcon } from "@phosphor-icons/react/dist/csr/Calendar";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { NotebookIcon } from "@phosphor-icons/react/dist/csr/Notebook";
import { BowlFoodIcon } from "@phosphor-icons/react/dist/csr/BowlFood";
import { AirplaneIcon } from "@phosphor-icons/react/dist/csr/Airplane";
import { SuitcaseIcon } from "@phosphor-icons/react/dist/csr/Suitcase";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { GraduationCapIcon } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { CloudSunIcon } from "@phosphor-icons/react/dist/csr/CloudSun";
import { PersonSimpleRunIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleRun";
import { PersonSimpleBikeIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleBike";
import { BedIcon } from "@phosphor-icons/react/dist/csr/Bed";
import { FilmSlateIcon } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { ChalkboardTeacherIcon } from "@phosphor-icons/react/dist/csr/ChalkboardTeacher";
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack";
import { MicrophoneStageIcon } from "@phosphor-icons/react/dist/csr/MicrophoneStage";
import { HammerIcon } from "@phosphor-icons/react/dist/csr/Hammer";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/csr/MapTrifold";
import { VinylRecordIcon } from "@phosphor-icons/react/dist/csr/VinylRecord";
import { RocketIcon } from "@phosphor-icons/react/dist/csr/Rocket";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { CookingPotIcon } from "@phosphor-icons/react/dist/csr/CookingPot";
import { TelevisionIcon } from "@phosphor-icons/react/dist/csr/Television";
import { TShirtIcon } from "@phosphor-icons/react/dist/csr/TShirt";
import { PawPrintIcon } from "@phosphor-icons/react/dist/csr/PawPrint";
import { HandHeartIcon } from "@phosphor-icons/react/dist/csr/HandHeart";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { TranslateIcon } from "@phosphor-icons/react/dist/csr/Translate";
import { HandsClappingIcon } from "@phosphor-icons/react/dist/csr/HandsClapping";
import { LifebuoyIcon } from "@phosphor-icons/react/dist/csr/Lifebuoy";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { HamburgerIcon } from "@phosphor-icons/react/dist/csr/Hamburger";
import { MountainsIcon } from "@phosphor-icons/react/dist/csr/Mountains";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { PersonSimpleSwimIcon } from "@phosphor-icons/react/dist/csr/PersonSimpleSwim";
import { FlowerLotusIcon } from "@phosphor-icons/react/dist/csr/FlowerLotus";
import { HandFistIcon } from "@phosphor-icons/react/dist/csr/HandFist";
import { PenNibIcon } from "@phosphor-icons/react/dist/csr/PenNib";
import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/csr/PuzzlePiece";
import { BuildingsIcon } from "@phosphor-icons/react/dist/csr/Buildings";
import { BroadcastIcon } from "@phosphor-icons/react/dist/csr/Broadcast";
import { WindIcon } from "@phosphor-icons/react/dist/csr/Wind";
import { MaskHappyIcon } from "@phosphor-icons/react/dist/csr/MaskHappy";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { PersonSimpleIcon } from "@phosphor-icons/react/dist/csr/PersonSimple";
import { PaintBrushIcon } from "@phosphor-icons/react/dist/csr/PaintBrush";
import { WineIcon } from "@phosphor-icons/react/dist/csr/Wine";
import { PopcornIcon } from "@phosphor-icons/react/dist/csr/Popcorn";
import { CityIcon } from "@phosphor-icons/react/dist/csr/City";
import { CarIcon } from "@phosphor-icons/react/dist/csr/Car";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { PresentationIcon } from "@phosphor-icons/react/dist/csr/Presentation";
import { LaptopIcon } from "@phosphor-icons/react/dist/csr/Laptop";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { CubeIcon } from "@phosphor-icons/react/dist/csr/Cube";
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp";
import type { Icon } from "@phosphor-icons/react";
import { TRIBES, type TribeId, tribeById } from "@/lib/mutuals-data";
import { uploadAvatar } from "@/lib/uploads";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_OPTIONS,
  INTEREST_PRIMARY_MAX,
  INTEREST_PRIMARY_MIN,
  INTEREST_SECONDARY_MAX,
  SOCIAL_INTENT_OPTIONS,
  primaryInterests,
  secondaryInterests,
  toggleInterest,
  toggleSelection,
  type AvailabilityId,
  type GenderId,
  type InterestId,
  type SocialIntentId,
} from "@/lib/profile-options";
import {
  useHandleAvailability,
  handleFieldHint,
  handleFieldHintTone,
} from "@/hooks/use-handle-availability";
import { GenderSelect } from "./GenderSelect";
import { defaultAvatarUrl } from "@/lib/default-avatar";
import {
  requestBrowserLocation,
  type BrowserLocation,
  type LocationRadiusKm,
} from "@/lib/location";
import { resolveMyLocationLabel } from "@/lib/location.functions";
import { CitySelect } from "./CitySelect";
import { DiscoveryRadiusSlider } from "./DiscoveryRadiusSlider";

export interface Profile {
  /** Tribes the user has joined. First entry is the primary tribe. */
  tribeIds: TribeId[];
  name: string;
  handle?: string | null;
  city: string;
  bio: string;
  avatar: string;
  interests: InterestId[];
  socialIntents: SocialIntentId[];
  availability: AvailabilityId[];
  gender: GenderId | null;
  plan: "free" | "plus";
  ventureCount: number;
}

export type OnboardingLocation = BrowserLocation & {
  radius_km: LocationRadiusKm;
  discoverable: true;
};

/** Convenience helper: the user's primary (first joined) tribe. */
export const primaryTribe = (profile: Profile): TribeId => profile.tribeIds[0];

export function Onboarding({
  onDone,
  saving = false,
}: {
  onDone: (profile: Profile, location?: OnboardingLocation) => void;
  saving?: boolean;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [tribeId, setTribeId] = useState<TribeId | null>(null);
  const [tribeIndex, setTribeIndex] = useState(0);
  const [tribeFlipped, setTribeFlipped] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("🌿");
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [socialIntents, setSocialIntents] = useState<SocialIntentId[]>([]);
  const [availability, setAvailability] = useState<AvailabilityId[]>([]);
  const [gender, setGender] = useState<GenderId | null>(null);
  const [radiusKm, setRadiusKm] = useState<LocationRadiusKm>(15);
  const [location, setLocation] = useState<BrowserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resolveLocation = useServerFn(resolveMyLocationLabel);

  const tribe = tribeId ? tribeById(tribeId) : null;
  // null until both Tribe and gender are known - same rule the final submit
  // (see resolvedAvatar below) already used, just surfaced live on step 2
  // instead of only appearing once onboarding is already done.
  const previewAvatarUrl = defaultAvatarUrl(tribeId, gender);
  const viewedTribe = TRIBES[tribeIndex];
  const handleValid = handle.length >= 3 && handle.length <= 30;
  const handleAvailability = useHandleAvailability(handle, handleValid);
  const tribePrimaryInterests = tribeId ? primaryInterests(tribeId) : [];
  const tribeSecondaryInterests = tribeId ? secondaryInterests(tribeId) : [];
  const primaryInterestCount = interests.filter((id) =>
    tribePrimaryInterests.some((option) => option.id === id),
  ).length;
  const secondaryInterestCount = interests.length - primaryInterestCount;
  const socialProfileReady = Boolean(
    city.trim() &&
    primaryInterestCount >= INTEREST_PRIMARY_MIN &&
    socialIntents.length >= 1 &&
    availability.length >= 1,
  );
  const steps = [1, 2, 3, 4];

  const sanitizeHandle = (value: string) =>
    value
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);

  const openAvatarPicker = () => {
    if (uploading) return;
    const input = avatarInputRef.current;
    if (!input) {
      toast.error("Photo picker unavailable", {
        description: "Return to this step and try again.",
      });
      return;
    }

    input.value = "";
    input.click();
  };

  const onPickAvatar = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      setAvatar(await uploadAvatar(user.id, file));
    } catch (error) {
      toast.error("Upload failed", { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const locate = async () => {
    setLocating(true);
    try {
      const next = await requestBrowserLocation();
      setLocation(next);
      // Fill the city from the coordinates as well. The server re-derives this
      // on save, so this is only to show the person what it resolved to before
      // they commit — but seeing a meaningful district or city appear is the
      // thing that makes the permission prompt feel worth answering.
      const { city: resolved } = await resolveLocation({ data: next });
      if (resolved) setCity(resolved);
      toast.success(resolved ? `Location set — ${resolved}` : "Approximate location ready", {
        description: "Other members will only see a distance band, never your coordinates.",
      });
    } catch (error) {
      toast.error("Location unavailable", { description: (error as Error).message });
    } finally {
      setLocating(false);
    }
  };

  const finish = () => {
    if (!tribeId || !gender) return;
    // Only stand in for a photo the person never took the time to add -
    // never override an actual upload.
    const isCustomAvatar = avatar.startsWith("data:") || avatar.startsWith("http");
    const resolvedAvatar = isCustomAvatar ? avatar : (defaultAvatarUrl(tribeId, gender) ?? avatar);
    onDone(
      {
        tribeIds: [tribeId],
        name: name.trim(),
        handle,
        city: city.trim(),
        bio: bio.trim(),
        avatar: resolvedAvatar,
        interests,
        socialIntents,
        availability,
        gender,
        plan: "free",
        ventureCount: 0,
      },
      location ? { ...location, radius_km: radiusKm, discoverable: true } : undefined,
    );
  };

  return (
    <div
      className={cn(
        "bg-habitat relative overflow-x-hidden",
        // Steps 3+'s content is naturally scrollable (the interest pickers
        // need it) - steps 0-2 each have a fixed budget of things to show,
        // so those are the ones that should never grow past the viewport
        // instead of just relying on it usually fitting.
        step <= 2 ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <span className="ambient-orb ambient-orb-1" style={{ background: "#C84B31" }} />
        <span className="ambient-orb ambient-orb-2" style={{ background: "#3A7CA5" }} />
        <span className="ambient-orb ambient-orb-3" style={{ background: "#8B5CF6" }} />
        <span className="ambient-orb ambient-orb-4" style={{ background: "#D4A853" }} />
        <span className="ambient-orb ambient-orb-5" style={{ background: "#4A7C59" }} />
      </div>

      <div
        className={cn(
          "relative z-10 mx-auto flex max-w-md flex-col px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]",
          step <= 2 ? "h-full min-h-0" : "min-h-dvh",
        )}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous onboarding step"
            onClick={() => step > 0 && setStep(step - 1)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              step === 0 && "invisible",
            )}
          >
            <CaretLeftIcon className="h-5 w-5" />
          </button>
          <div
            className={cn("flex gap-1.5", step === 0 && "invisible")}
            aria-label={step ? `Step ${step} of 4` : undefined}
          >
            {steps.map((item) => (
              <span
                key={item}
                className={cn(
                  "h-1 w-7 rounded-full transition-colors",
                  item <= step ? "bg-primary" : "bg-secondary",
                )}
              />
            ))}
          </div>
          <span className="w-11" />
        </div>

        {step === 0 && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mt-8 shrink-0 animate-rise">
              <p className="label-mono text-muted-foreground">MEUTUALS</p>
              <h1 className="mt-2 text-balance font-display text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[38px]">
                Start with your <span className="text-primary">Tribe</span>.
                <br />
                Venture when you're ready.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Find people who share your scene, your rhythm, and—only if you choose—your part of
                town.
              </p>
            </div>
            {/* flex-1 + min-h-0 is what lets the artwork actually shrink to
                whatever's left of the viewport instead of the fixed-aspect
                box it normally is - the one thing on this screen with room
                to give, since the headline/button/copy above and below are
                already as tight as they read well. */}
            <div className="flex min-h-0 flex-1 items-center justify-center py-3">
              <FeatureIllustration
                src={welcomeArt}
                size="lg"
                eager
                className="aspect-auto h-full max-h-[280px] w-auto max-w-[260px]"
              />
            </div>
            <div className="shrink-0 pt-2">
              <PrimaryButton onClick={() => setStep(1)}>
                Get started <ArrowRightIcon className="h-4 w-4" />
              </PrimaryButton>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                For socially curious adults, 18+
              </p>
              {/* No LegalFooter here - Terms/Privacy/Guidelines already show
                  up on the signup screen right before an account is
                  actually created, which is where agreeing to them means
                  something. Repeating it on the welcome screen, before any
                  data is collected, was pure duplication and the single
                  biggest thing pushing this screen past the viewport. */}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0">
              <StepHeading
                step={1}
                title="Choose your first Tribe."
                body="Turn each card to understand the people, rhythm, and conversations inside."
              />
            </div>

            <div className="mt-4 flex shrink-0 items-center justify-between">
              <button
                type="button"
                aria-label="Previous Tribe"
                onClick={() => {
                  setTribeIndex((tribeIndex - 1 + TRIBES.length) % TRIBES.length);
                  setTribeFlipped(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <CaretLeftIcon className="h-5 w-5" />
              </button>
              <div className="text-center">
                <p className="label-mono text-muted-foreground">
                  Card {tribeIndex + 1} / {TRIBES.length}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {tribeId === viewedTribe.id ? "Your current choice" : "Explore before choosing"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Next Tribe"
                onClick={() => {
                  setTribeIndex((tribeIndex + 1) % TRIBES.length);
                  setTribeFlipped(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <CaretRightIcon className="h-5 w-5" />
              </button>
            </div>

            {/* flex-1 + min-h-0, same fix as the welcome screen's artwork:
                this card is what has to give on a short viewport instead of
                pushing the page into a scroll, so it's sized from the
                available height (h-full) rather than the available width
                (w-full) - aspect-[3/4] then derives width from whatever
                height it actually got. */}
            <div className="mt-3 flex min-h-0 flex-1 items-center justify-center [perspective:1200px]">
              <button
                type="button"
                aria-label={`${tribeFlipped ? "Show artwork for" : "Learn about"} ${viewedTribe.name}`}
                aria-pressed={tribeFlipped}
                onClick={() => setTribeFlipped((current) => !current)}
                className="relative block aspect-[3/4] h-full max-h-[420px] w-auto max-w-[20rem] rounded-[1.75rem] text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <span
                  className={cn(
                    "absolute inset-0 block transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
                    tribeFlipped && "[transform:rotateY(180deg)]",
                  )}
                >
                  <span
                    aria-hidden={tribeFlipped}
                    className="absolute inset-0 block overflow-hidden rounded-[1.75rem] border border-primary/35 bg-card [backface-visibility:hidden]"
                    style={{
                      boxShadow: `0 24px 60px color-mix(in oklab, ${viewedTribe.colorVar} 25%, transparent)`,
                    }}
                  >
                    <img src={viewedTribe.art} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />
                    <span className="absolute left-5 right-5 top-5 flex items-center justify-between">
                      <span className="label-mono rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white/80 backdrop-blur-md">
                        MEUTUALS · TRIBE
                      </span>
                      {tribeId === viewedTribe.id && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <CheckIcon className="h-4 w-4" />
                        </span>
                      )}
                    </span>
                    <span className="absolute bottom-5 left-5 right-5 text-white">
                      <span className="font-display text-3xl font-bold">{viewedTribe.name}</span>
                      <span className="mt-1 block text-xs text-white/70">{viewedTribe.scene}</span>
                      <span className="mt-4 flex items-center gap-2 label-mono text-white/75">
                        <ArrowCounterClockwiseIcon className="h-3.5 w-3.5" /> Tap to reveal the
                        Tribe
                      </span>
                    </span>
                  </span>

                  <span
                    aria-hidden={!tribeFlipped}
                    className="absolute inset-0 flex flex-col overflow-hidden rounded-[1.75rem] border border-primary/40 bg-card p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-0 opacity-10"
                      style={{
                        background: `radial-gradient(circle at 80% 10%, ${viewedTribe.colorVar}, transparent 45%)`,
                      }}
                    />
                    <span className="relative flex items-center justify-between">
                      <span className="label-mono text-primary">Inside the card</span>
                      <ArrowCounterClockwiseIcon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span className="relative mt-3 font-display text-2xl font-bold">
                      {viewedTribe.motto}
                    </span>
                    <span className="relative mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      {viewedTribe.about}
                    </span>
                    <span className="relative mt-4 label-mono text-muted-foreground">
                      What happens here
                    </span>
                    <span className="relative mt-1.5 grid gap-1.5">
                      {viewedTribe.inside.map((item) => (
                        <span
                          key={item}
                          className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-1.5 text-[11px] font-semibold"
                        >
                          <SparkleIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {item}
                        </span>
                      ))}
                    </span>
                    <span className="relative mt-auto rounded-2xl bg-primary/10 p-2.5">
                      <span className="label-mono text-primary">Best for</span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                        {viewedTribe.bestFor}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            </div>

            <div
              className="mt-4 flex shrink-0 items-center justify-center gap-1.5"
              aria-label={`Viewing Tribe ${tribeIndex + 1} of ${TRIBES.length}`}
            >
              {TRIBES.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  aria-label={`View ${item.name}`}
                  onClick={() => {
                    setTribeIndex(index);
                    setTribeFlipped(false);
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    tribeIndex === index
                      ? "w-7 bg-primary"
                      : "w-2 bg-border hover:bg-muted-foreground/50",
                  )}
                />
              ))}
            </div>

            <div className="mt-auto shrink-0 pt-5">
              <PrimaryButton
                onClick={() => {
                  if (tribeId === viewedTribe.id) setStep(2);
                  else setTribeId(viewedTribe.id);
                }}
              >
                {tribeId === viewedTribe.id
                  ? `Continue with ${viewedTribe.name}`
                  : `Choose ${viewedTribe.name}`}{" "}
                <ArrowRightIcon className="h-4 w-4" />
              </PrimaryButton>
              {tribeId && tribeId !== viewedTribe.id && (
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Currently selected: {tribe?.name}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0">
              <StepHeading
                step={2}
                title="Make it recognizably you."
                body="A name people can remember and a handle they can find."
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-2">
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={uploading}
                aria-label="Add profile photo"
                className="relative flex h-24 w-24 items-center justify-center rounded-full transition-transform active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:cursor-wait"
              >
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-card text-4xl">
                  {avatar.startsWith("data:") || avatar.startsWith("http") ? (
                    // A real uploaded photo always wins.
                    <img
                      src={avatar}
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                    />
                  ) : previewAvatarUrl ? (
                    // Nothing uploaded, but the Tribe (always known by this
                    // step) and gender (just picked) are both in - show what
                    // will actually land on the profile instead of the leaf
                    // sitting there as if nothing had been chosen yet.
                    <img
                      src={previewAvatarUrl}
                      alt="Default profile preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    avatar
                  )}
                </span>
                {uploading && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
                    <SpinnerGapIcon className="h-5 w-5 animate-spin text-primary" />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={uploading}
                className="mt-3 min-h-11 rounded-xl px-4 text-sm font-semibold text-primary underline-offset-4 transition-opacity hover:underline active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Add photo"}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif"
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void onPickAvatar(file);
                }}
              />
              <p className="mt-3 text-[11px] text-muted-foreground">
                A photo helps with trust. The leaf works too.
              </p>
            </div>
            <div className="mt-7 shrink-0 space-y-4">
              <Field
                label="Display name"
                value={name}
                onChange={(value) => setName(value.slice(0, 60))}
                placeholder="Alex Rivera"
                autoComplete="name"
              />
              <Field
                label="@handle"
                value={handle}
                onChange={(value) => setHandle(sanitizeHandle(value))}
                placeholder="alexrivera"
                autoComplete="username"
                hint={handleFieldHint(handle, handleValid, handleAvailability)}
                hintTone={handleFieldHintTone(handleAvailability)}
              />
              <GenderSelect value={gender} onChange={setGender} hint="Shown on your profile" />
            </div>
            <div className="mt-auto shrink-0 pt-8">
              <PrimaryButton
                disabled={
                  !name.trim() ||
                  !handleValid ||
                  handleAvailability === "taken" ||
                  handleAvailability === "checking" ||
                  !gender ||
                  uploading
                }
                onClick={() => setStep(3)}
              >
                Build my social signal <ArrowRightIcon className="h-4 w-4" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <StepHeading
              step={3}
              title="What should people know?"
              body="These signals make Discover useful instead of random."
            />
            <div className="mt-6 space-y-6">
              {/* Device location is the primary path. Manual selection is a
                  recovery path for denied permissions or unavailable GPS, not
                  a second competing source of truth. */}
              <div>
                <p className="label-mono mb-1 text-muted-foreground">City or local area</p>
                {location ? (
                  <div className="rounded-2xl border border-primary/35 bg-primary/10 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-meutuals-gradient text-white">
                        <CheckIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                          Current area confirmed
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold">
                          {city || "Area found"}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          Refreshes automatically each time you open MEUTUALS, so your distance to
                          others stays accurate. Other members only ever see a distance band, never
                          your exact coordinates.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={locate}
                        disabled={locating}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/35 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                      >
                        {locating ? (
                          <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <CrosshairIcon className="h-4 w-4" />
                        )}
                        Check again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLocation(null);
                          setCity("");
                        }}
                        className="min-h-11 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Choose manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={locate}
                      disabled={locating}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
                    >
                      {locating ? (
                        <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <CrosshairIcon className="h-4 w-4" />
                      )}
                      {locating ? "Finding your area…" : "Use my current area"}
                    </button>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      Uses this device once to find your district or city. Your pin is never shown.
                    </p>
                    <div className="mt-4 border-t border-border pt-4">
                      <CitySelect
                        value={city}
                        onChange={setCity}
                        label="Can't use device location? Choose manually"
                      />
                    </div>
                  </>
                )}
              </div>

              <Field
                label="Short bio"
                value={bio}
                onChange={(value) => setBio(value.slice(0, 140))}
                placeholder="A line about how you like to socialize."
                multiline
                hint={`${bio.length}/140`}
              />
              {tribe && (
                <ChoiceGroup
                  label={`Because you're in ${tribe.name}`}
                  hint={`${primaryInterestCount}/${INTEREST_PRIMARY_MAX} · choose ${INTEREST_PRIMARY_MIN}-${INTEREST_PRIMARY_MAX}`}
                  options={tribePrimaryInterests}
                  selected={interests}
                  accentColor={tribe.colorVar}
                  maxVisible={8}
                  onToggle={(id) =>
                    setInterests(toggleInterest(interests, id as InterestId, tribe.id, true))
                  }
                />
              )}
              <ChoiceGroup
                label="More interests"
                hint={`${secondaryInterestCount}/${INTEREST_SECONDARY_MAX}`}
                options={tribeSecondaryInterests}
                selected={interests}
                maxVisible={8}
                onToggle={(id) =>
                  tribeId &&
                  setInterests(toggleInterest(interests, id as InterestId, tribeId, false))
                }
              />
              <ChoiceGroup
                label="Here for"
                hint={`${socialIntents.length}/5 · choose at least 1`}
                options={SOCIAL_INTENT_OPTIONS}
                selected={socialIntents}
                maxVisible={8}
                onToggle={(id) =>
                  setSocialIntents(toggleSelection(socialIntents, id as SocialIntentId, 5))
                }
              />
              <ChoiceGroup
                label="Usually free"
                hint="Choose at least 1"
                options={AVAILABILITY_OPTIONS}
                selected={availability}
                onToggle={(id) =>
                  setAvailability(toggleSelection(availability, id as AvailabilityId, 7))
                }
              />
            </div>
            <div className="mt-auto pt-8">
              <PrimaryButton disabled={!socialProfileReady} onClick={() => setStep(4)}>
                Set nearby preferences <ArrowRightIcon className="h-4 w-4" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-1 flex-col">
            <StepHeading
              step={4}
              title="Meet your part of the city."
              body="Optional. Nearby works without revealing where you are."
            />
            <div className="mt-7 rounded-3xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <ShieldCheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-lg font-bold">Private by design</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    We store only an approximate point. Members see “within 5 km” or “same
                    city”—never a pin, address, or live movement.
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <DiscoveryRadiusSlider value={radiusKm} onChange={setRadiusKm} />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Nearby setup progress">
                <SetupStage done label="Choose range" />
                <SetupStage done={Boolean(location)} active={!location} label="Confirm area" />
                <SetupStage done={Boolean(location)} label="Ready" />
              </div>
              {location ? (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-primary/10 p-4 text-primary">
                  <CheckIcon className="h-5 w-5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Approximate location ready</p>
                    <p className="text-[11px] text-muted-foreground">
                      {city ? `${city} · ` : ""}Update, pause, or remove it in Settings.
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={locating}
                  onClick={locate}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary disabled:opacity-60"
                >
                  {locating ? (
                    <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CrosshairIcon className="h-4 w-4" />
                  )}
                  {locating ? "Finding your area…" : "Use approximate location"}
                </button>
              )}
            </div>
            <div className="mt-auto space-y-3 pt-8">
              <PrimaryButton disabled={saving || uploading || locating} onClick={finish}>
                {saving
                  ? "Creating profile…"
                  : location
                    ? "Finish nearby setup"
                    : "Finish my profile"}
                {!saving && <ArrowRightIcon className="h-4 w-4" />}
              </PrimaryButton>
              {!location && (
                <button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  className="min-h-11 w-full rounded text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Finish with city only
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeading({ step, title, body }: { step: number; title: string; body: string }) {
  return (
    <div className="mt-8 animate-rise">
      <p className="label-mono text-muted-foreground">Step {step} of 4</p>
      <h2 className="mt-2 font-display text-3xl font-bold leading-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-meutuals-gradient px-4 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-[opacity,transform,filter] hover:brightness-110 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const OPTION_ICONS: Record<string, Icon> = {
  outdoors: TreeIcon,
  fitness: BarbellIcon,
  running_training: PersonSimpleRunIcon,
  cycling: PersonSimpleBikeIcon,
  recovery_habits: BedIcon,
  hiking: MountainsIcon,
  team_sports: UsersThreeIcon,
  swimming: PersonSimpleSwimIcon,
  yoga: FlowerLotusIcon,
  martial_arts: HandFistIcon,
  rock_climbing: MountainsIcon,
  gym_workouts: BarbellIcon,
  surfing: PersonSimpleSwimIcon,
  badminton: UsersThreeIcon,
  football: PulseIcon,
  books: BookOpenIcon,
  journaling: NotebookIcon,
  film_book_clubs: FilmSlateIcon,
  learning_workshops: ChalkboardTeacherIcon,
  collecting: StackIcon,
  poetry_writing: PenNibIcon,
  tabletop_games: PuzzlePieceIcon,
  museums_exhibits: BuildingsIcon,
  podcasts: BroadcastIcon,
  meditation: WindIcon,
  language_learning: TranslateIcon,
  calligraphy: PenNibIcon,
  gardening: TreeIcon,
  astronomy: SparkleIcon,
  history: BuildingsIcon,
  music: MusicNoteIcon,
  art: PaletteIcon,
  live_shows: MicrophoneStageIcon,
  crafting_making: HammerIcon,
  photography: CameraIcon,
  theatre_performance: MaskHappyIcon,
  film_video_making: VideoCameraIcon,
  dance: PersonSimpleIcon,
  singing: MicrophoneIcon,
  tattoo_body_art: PaintBrushIcon,
  fashion_design: PaletteIcon,
  graphic_design: CubeIcon,
  pottery: HammerIcon,
  street_art: PaintBrushIcon,
  animation: VideoCameraIcon,
  nightlife: MoonStarsIcon,
  late_night_eats: BowlFoodIcon,
  karaoke: MicrophoneIcon,
  city_walks: MapTrifoldIcon,
  live_music_dj: VinylRecordIcon,
  bar_hopping: WineIcon,
  street_food: PopcornIcon,
  rooftop_hangouts: CityIcon,
  late_night_drives: CarIcon,
  clubbing: SpeakerHighIcon,
  live_comedy: MicrophoneStageIcon,
  night_markets: PopcornIcon,
  cocktail_making: WineIcon,
  arcade_games: GameControllerIcon,
  night_photography: CameraIcon,
  tech: CpuIcon,
  business: BriefcaseIcon,
  startups_networking: RocketIcon,
  side_projects: WrenchIcon,
  investing_finance: ChartLineUpIcon,
  public_speaking: PresentationIcon,
  freelancing: LaptopIcon,
  marketing_branding: MegaphoneIcon,
  product_design: CubeIcon,
  career_growth: TrendUpIcon,
  ai_and_data: CpuIcon,
  ecommerce: BriefcaseIcon,
  consulting: PresentationIcon,
  leadership: TrendUpIcon,
  productivity: RocketIcon,
  food: ForkKnifeIcon,
  coffee: CoffeeIcon,
  cooking: CookingPotIcon,
  wellness: HeartbeatIcon,
  games: GameControllerIcon,
  travel: AirplaneIcon,
  movies_tv: TelevisionIcon,
  fashion: TShirtIcon,
  pets: PawPrintIcon,
  volunteering: HandHeartIcon,
  make_friends: UsersIcon,
  activity_partner: PulseIcon,
  casual_hangouts: ChatCircleIcon,
  local_exploration: CompassIcon,
  networking: NetworkIcon,
  creative_collab: LightbulbIcon,
  accountability_partner: TargetIcon,
  travel_companion: SuitcaseIcon,
  mentorship: GraduationCapIcon,
  event_companion: TicketIcon,
  language_exchange: TranslateIcon,
  volunteer_together: HandsClappingIcon,
  support_advice: LifebuoyIcon,
  weekday_mornings: SunIcon,
  weekday_afternoons: CloudSunIcon,
  weekday_evenings: SunHorizonIcon,
  weekends: CalendarIcon,
  spontaneous: LightningIcon,
  late_nights: MoonIcon,
  lunch_breaks: HamburgerIcon,
};

function ChoiceGroup({
  label,
  hint,
  options,
  selected,
  onToggle,
  accentColor,
  maxVisible,
}: {
  label: string;
  hint: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  /** Tints the active state with a specific Tribe's own color instead of
   *  the generic brand gradient - reserved for the "Because you're in
   *  {Tribe}" primary interest group, so its picks visibly read as tied to
   *  that Tribe rather than looking identical to a general pick. */
  accentColor?: string;
  /** Collapses the grid to this many options with a "Show more" toggle
   *  below - option pools got wide enough (up to 75 for a single Tribe's
   *  primary tier) that dumping all of them on screen at once isn't
   *  browsable. Omit for a group short enough to just show in full. */
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = maxVisible != null && options.length > maxVisible;
  const visibleOptions = collapsible && !expanded ? options.slice(0, maxVisible) : options;

  return (
    <fieldset>
      <div className="flex items-center justify-between gap-3">
        <legend
          className={cn("label-mono", !accentColor && "text-muted-foreground")}
          style={accentColor ? { color: accentColor } : undefined}
        >
          {label}
        </legend>
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {visibleOptions.map((option) => {
          const active = selected.includes(option.id);
          const Icon = OPTION_ICONS[option.id] ?? CheckIcon;
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={active}
              onClick={() => onToggle(option.id)}
              className={cn(
                "group flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs font-semibold transition-[transform,border-color,background-color,color] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? accentColor
                    ? "border-transparent text-white shadow-sm"
                    : "border-transparent bg-meutuals-gradient text-white shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
              style={active && accentColor ? { backgroundColor: accentColor } : undefined}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-secondary text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <span className="leading-snug">{option.label}</span>
            </button>
          );
        })}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98]"
        >
          {expanded ? "Show less" : `Show ${options.length - maxVisible} more`}
          <CaretDownIcon className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </fieldset>
  );
}

function SetupStage({
  label,
  done,
  active = false,
}: {
  label: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-2 py-3 text-center",
        done
          ? "border-primary/40 bg-primary/10"
          : active
            ? "border-primary/50 bg-background"
            : "border-border bg-background/50",
      )}
    >
      <span
        className={cn(
          "mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
          done ? "bg-meutuals-gradient text-white" : "bg-secondary text-muted-foreground",
        )}
      >
        {done ? <CheckIcon className="h-3.5 w-3.5" /> : "·"}
      </span>
      <p className="mt-1.5 text-[9px] font-semibold text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  hint,
  hintTone = "muted",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  hintTone?: "muted" | "success" | "danger";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="label-mono text-muted-foreground">{label}</span>
        {hint && (
          <span
            className={cn(
              "text-right text-[10px]",
              hintTone === "success" && "text-accent",
              hintTone === "danger" && "text-destructive",
              hintTone === "muted" && "text-muted-foreground",
            )}
          >
            {hint}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      )}
    </label>
  );
}
