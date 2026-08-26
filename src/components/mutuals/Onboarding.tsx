import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FeatureIllustration } from "./FeatureIllustration";
import welcomeArt from "@/assets/app-illustrations/onboarding-01.webp";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  LocateFixed,
  ShieldCheck,
  TreePine,
  Dumbbell,
  BookOpen,
  Music2,
  Palette,
  Utensils,
  Coffee,
  MoonStar,
  Cpu,
  BriefcaseBusiness,
  HeartPulse,
  Gamepad2,
  Users,
  Activity,
  MessageCircle,
  Compass,
  Network,
  Lightbulb,
  Sunrise,
  Sunset,
  CalendarDays,
  Zap,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { TRIBES, type TribeId, tribeById } from "@/lib/mutuals-data";
import { LegalFooter } from "./LegalFooter";
import { uploadAvatar } from "@/lib/uploads";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_OPTIONS,
  INTEREST_OPTIONS,
  SOCIAL_INTENT_OPTIONS,
  toggleSelection,
  type AvailabilityId,
  type InterestId,
  type SocialIntentId,
} from "@/lib/profile-options";
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
  const [radiusKm, setRadiusKm] = useState<LocationRadiusKm>(15);
  const [location, setLocation] = useState<BrowserLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resolveLocation = useServerFn(resolveMyLocationLabel);

  const tribe = tribeId ? tribeById(tribeId) : null;
  const viewedTribe = TRIBES[tribeIndex];
  const handleValid = handle.length >= 3 && handle.length <= 30;
  const socialProfileReady = Boolean(
    city.trim() && interests.length >= 2 && socialIntents.length >= 1 && availability.length >= 1,
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
    if (!tribeId) return;
    onDone(
      {
        tribeIds: [tribeId],
        name: name.trim(),
        handle,
        city: city.trim(),
        bio: bio.trim(),
        avatar,
        interests,
        socialIntents,
        availability,
        plan: "free",
        ventureCount: 0,
      },
      location ? { ...location, radius_km: radiusKm, discoverable: true } : undefined,
    );
  };

  return (
    <div className="bg-habitat relative min-h-dvh overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <span className="ambient-orb ambient-orb-1" style={{ background: "#C84B31" }} />
        <span className="ambient-orb ambient-orb-2" style={{ background: "#3A7CA5" }} />
        <span className="ambient-orb ambient-orb-3" style={{ background: "#8B5CF6" }} />
        <span className="ambient-orb ambient-orb-4" style={{ background: "#D4A853" }} />
        <span className="ambient-orb ambient-orb-5" style={{ background: "#4A7C59" }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous onboarding step"
            onClick={() => step > 0 && setStep(step - 1)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground",
              step === 0 && "invisible",
            )}
          >
            <ArrowLeft className="h-5 w-5" />
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
          <div className="flex flex-1 flex-col">
            <div className="mt-16 animate-rise">
              <p className="label-mono text-muted-foreground">MEUTUALS</p>
              <h1 className="mt-3 font-display text-[44px] font-bold leading-[1.05] tracking-tight">
                Start with your <span className="text-primary">Tribe</span>.
                <br />
                Venture when you're ready.
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Find people who share your scene, your rhythm, and—only if you choose—your part of
                town.
              </p>
              <FeatureIllustration src={welcomeArt} size="lg" eager className="mt-8" />
            </div>
            <div className="mt-auto pt-10">
              <PrimaryButton onClick={() => setStep(1)}>
                Get started <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                For socially curious adults, 21+
              </p>
              <LegalFooter className="mt-4" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <StepHeading
              step={1}
              title="Choose your first Tribe."
              body="Turn each card to understand the people, rhythm, and conversations inside."
            />

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous Tribe"
                onClick={() => {
                  setTribeIndex((tribeIndex - 1 + TRIBES.length) % TRIBES.length);
                  setTribeFlipped(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronLeft className="h-5 w-5" />
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
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-auto mt-3 w-full max-w-[20rem] [perspective:1200px]">
              <button
                type="button"
                aria-label={`${tribeFlipped ? "Show artwork for" : "Learn about"} ${viewedTribe.name}`}
                aria-pressed={tribeFlipped}
                onClick={() => setTribeFlipped((current) => !current)}
                className="relative block aspect-[3/4] w-full rounded-[1.75rem] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
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
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </span>
                    <span className="absolute bottom-5 left-5 right-5 text-white">
                      <span className="font-display text-3xl font-bold">{viewedTribe.name}</span>
                      <span className="mt-1 block text-xs text-white/70">{viewedTribe.scene}</span>
                      <span className="mt-4 flex items-center gap-2 label-mono text-white/75">
                        <RotateCcw className="h-3.5 w-3.5" /> Tap to reveal the Tribe
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
                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
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
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
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
              className="mt-4 flex items-center justify-center gap-1.5"
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
                    "h-2 rounded-full transition-all",
                    tribeIndex === index
                      ? "w-7 bg-primary"
                      : "w-2 bg-border hover:bg-muted-foreground/50",
                  )}
                />
              ))}
            </div>

            <div className="mt-auto pt-5">
              <PrimaryButton
                onClick={() => {
                  if (tribeId === viewedTribe.id) setStep(2);
                  else setTribeId(viewedTribe.id);
                }}
              >
                {tribeId === viewedTribe.id
                  ? `Continue with ${viewedTribe.name}`
                  : `Choose ${viewedTribe.name}`}{" "}
                <ArrowRight className="h-4 w-4" />
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
          <div className="flex flex-1 flex-col">
            <StepHeading
              step={2}
              title="Make it recognizably you."
              body="A name people can remember and a handle they can find."
            />
            <div className="mt-6 flex flex-col items-center">
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={uploading}
                aria-label="Add profile photo"
                className="relative flex h-24 w-24 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:cursor-wait"
              >
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-card text-4xl">
                  {avatar.startsWith("data:") || avatar.startsWith("http") ? (
                    <img
                      src={avatar}
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    avatar
                  )}
                </span>
                {uploading && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={uploading}
                className="mt-3 min-h-11 rounded-xl px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
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
            <div className="mt-7 space-y-4">
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
                hint={
                  handle
                    ? handleValid
                      ? `@${handle}`
                      : "Use at least 3 characters"
                    : "Letters, numbers, underscore"
                }
              />
            </div>
            <div className="mt-auto pt-8">
              <PrimaryButton
                disabled={!name.trim() || !handleValid || uploading}
                onClick={() => setStep(3)}
              >
                Build my social signal <ArrowRight className="h-4 w-4" />
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
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                          Current area confirmed
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold">
                          {city || "Area found"}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          Updates only when you ask. MEUTUALS never tracks location in the
                          background.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={locate}
                        disabled={locating}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/35 text-xs font-semibold text-primary disabled:opacity-60"
                      >
                        {locating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LocateFixed className="h-4 w-4" />
                        )}
                        Check again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLocation(null);
                          setCity("");
                        }}
                        className="min-h-11 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground"
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
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary disabled:opacity-60"
                    >
                      {locating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LocateFixed className="h-4 w-4" />
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
              <ChoiceGroup
                label="Your interests"
                hint={`${interests.length}/8 · choose at least 2`}
                options={INTEREST_OPTIONS}
                selected={interests}
                onToggle={(id) => setInterests(toggleSelection(interests, id as InterestId, 8))}
              />
              <ChoiceGroup
                label="Here for"
                hint={`${socialIntents.length}/3 · choose at least 1`}
                options={SOCIAL_INTENT_OPTIONS}
                selected={socialIntents}
                onToggle={(id) =>
                  setSocialIntents(toggleSelection(socialIntents, id as SocialIntentId, 3))
                }
              />
              <ChoiceGroup
                label="Usually free"
                hint="Choose at least 1"
                options={AVAILABILITY_OPTIONS}
                selected={availability}
                onToggle={(id) =>
                  setAvailability(toggleSelection(availability, id as AvailabilityId, 4))
                }
              />
            </div>
            <div className="mt-auto pt-8">
              <PrimaryButton disabled={!socialProfileReady} onClick={() => setStep(4)}>
                Set nearby preferences <ArrowRight className="h-4 w-4" />
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
                  <ShieldCheck className="h-5 w-5" />
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
                  <Check className="h-5 w-5" />
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LocateFixed className="h-4 w-4" />
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
                    ? "Enter MEUTUALS nearby"
                    : "Enter MEUTUALS"}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </PrimaryButton>
              {!location && (
                <button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  className="min-h-11 w-full text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Continue with city only
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
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const OPTION_ICONS: Record<string, LucideIcon> = {
  outdoors: TreePine,
  fitness: Dumbbell,
  books: BookOpen,
  music: Music2,
  art: Palette,
  food: Utensils,
  coffee: Coffee,
  nightlife: MoonStar,
  tech: Cpu,
  business: BriefcaseBusiness,
  wellness: HeartPulse,
  games: Gamepad2,
  make_friends: Users,
  activity_partner: Activity,
  casual_hangouts: MessageCircle,
  local_exploration: Compass,
  networking: Network,
  creative_collab: Lightbulb,
  weekday_mornings: Sunrise,
  weekday_evenings: Sunset,
  weekends: CalendarDays,
  spontaneous: Zap,
};

function ChoiceGroup({
  label,
  hint,
  options,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <div className="flex items-center justify-between gap-3">
        <legend className="label-mono text-muted-foreground">{label}</legend>
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = selected.includes(option.id);
          const Icon = OPTION_ICONS[option.id] ?? Check;
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={active}
              onClick={() => onToggle(option.id)}
              className={cn(
                "group relative flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-[transform,border-color,background-color,color] active:scale-[0.98]",
                active
                  ? "border-primary bg-primary/15 text-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="leading-snug">{option.label}</span>
              {active && <Check className="absolute right-2 top-2 h-3 w-3" />}
            </button>
          );
        })}
      </div>
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
          done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : "·"}
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
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="label-mono text-muted-foreground">{label}</span>
        {hint && <span className="text-right text-[10px] text-muted-foreground">{hint}</span>}
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
