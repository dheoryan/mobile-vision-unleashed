import { useState } from "react";
import { ArrowRight, ArrowLeft, Camera } from "lucide-react";
import { TRIBES, type TribeId, tribeById } from "@/lib/mutuals-data";
import { cn } from "@/lib/utils";

export interface Profile {
  tribeId: TribeId;
  name: string;
  age: string;
  city: string;
  bio: string;
  avatar: string;
}

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0);
  const [tribeId, setTribeId] = useState<TribeId | null>(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatar] = useState("🌿");

  const tribe = tribeId ? tribeById(tribeId) : null;
  const ageOk = Number(age) >= 21;
  const ageBad = age !== "" && !ageOk;
  const canFinish = name.trim() && ageOk && city.trim();

  return (
    <div className="bg-habitat relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12">
        <div className="flex items-center justify-between">
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            className={cn("rounded-full p-2 text-muted-foreground", step === 0 && "invisible")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 w-8 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-secondary"
                )}
              />
            ))}
          </div>
          <span className="w-9" />
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="flex flex-1 flex-col">
            <div className="mt-16 animate-rise">
              <p className="label-mono text-muted-foreground">Mutuals</p>
              <h1 className="mt-3 font-display text-[44px] font-bold leading-[1.05] tracking-tight">
                Start with your <span className="text-primary">Tribe</span>.
                <br />
                Venture when you're ready.
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                A new social layer for real-life meetups. Begin where you feel at home — explore beyond when it feels right.
              </p>
            </div>

            <div className="mt-auto pt-10">
              <button
                onClick={() => setStep(1)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">For socially curious adults, 21+</p>
            </div>
          </div>
        )}

        {/* Step 1: Pick a Tribe */}
        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <div className="mt-8 animate-rise">
              <p className="label-mono text-muted-foreground">Step 1 of 3</p>
              <h2 className="mt-2 font-display text-3xl font-bold leading-tight">Pick your home base.</h2>
              <p className="mt-2 text-sm text-muted-foreground">You can explore other Tribes anytime.</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {TRIBES.map((t) => {
                const active = tribeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTribeId(t.id)}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border p-4 text-left transition-all animate-rise",
                      active ? "border-transparent" : "border-border bg-card"
                    )}
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, color-mix(in oklab, ${t.colorVar} 45%, var(--card)) 0%, var(--card) 100%)`,
                            boxShadow: `0 0 0 2px ${t.colorVar}`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 30%, transparent)` }}
                    >
                      {t.emoji}
                    </span>
                    <p className="mt-3 font-display text-base font-bold">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.scene}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-8">
              <button
                disabled={!tribeId}
                onClick={() => setStep(2)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
              >
                {tribe ? `Join ${tribe.name}` : "Pick a Tribe"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Profile */}
        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <div className="mt-8 animate-rise">
              <p className="label-mono text-muted-foreground">Step 2 of 3</p>
              <h2 className="mt-2 font-display text-3xl font-bold leading-tight">Set your profile.</h2>
              <p className="mt-2 text-sm text-muted-foreground">Just enough to feel like you.</p>
            </div>

            <div className="mt-6 flex flex-col items-center">
              <button
                className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-border bg-card text-4xl"
              >
                {avatar}
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Camera className="h-4 w-4" />
                </span>
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <Field label="Display name" value={name} onChange={setName} placeholder="Alex Rivera" />
              <Field label="Age" value={age} onChange={setAge} placeholder="21+" type="number" error={ageBad ? "Must be 21 or older" : undefined} />
              <Field label="City" value={city} onChange={setCity} placeholder="San Francisco" />
              <Field label="Bio" value={bio} onChange={(v) => setBio(v.slice(0, 140))} placeholder="A line about how you like to socialize." multiline hint={`${bio.length}/140`} />
            </div>

            <div className="mt-auto pt-8">
              <button
                disabled={!canFinish || !tribeId}
                onClick={() => tribeId && onDone({ tribeId, name, age, city, bio, avatar })}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
              >
                Enter Mutuals <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", multiline, hint, error,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; multiline?: boolean; hint?: string; error?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="label-mono text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      )}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </label>
  );
}
