import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { LegalFooter } from "@/components/mutuals/LegalFooter";
import logo from "@/assets/logo.png";
import { PasswordField } from "@/components/mutuals/PasswordField";
import {
  ageRetryAfter,
  earliestReasonableDateOfBirth,
  isEligibleDateOfBirth,
  isPlausibleDateOfBirth,
  lockAgeRetry,
  PENDING_DATE_OF_BIRTH_KEY,
} from "@/lib/age";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ageRetryAfter()) {
      toast.error("Age verification is temporarily locked for this browser.");
      return;
    }
    if (!isPlausibleDateOfBirth(dateOfBirth)) {
      toast.error("Enter a valid date of birth.");
      return;
    }
    if (!isEligibleDateOfBirth(dateOfBirth)) {
      lockAgeRetry();
      toast.error("You aren’t eligible to create a MEUTUALS account.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { date_of_birth: dateOfBirth },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your email", { description: "Confirm your address to finish signup." });
    navigate({ to: "/verify-email", search: { email } });
  };

  const oauth = async (provider: "google" | "apple") => {
    if (ageRetryAfter()) {
      toast.error("Age verification is temporarily locked for this browser.");
      return;
    }
    if (!isPlausibleDateOfBirth(dateOfBirth)) {
      toast.error("Enter your date of birth before continuing.");
      return;
    }
    if (!isEligibleDateOfBirth(dateOfBirth)) {
      lockAgeRetry();
      toast.error("You aren’t eligible to create a MEUTUALS account.");
      return;
    }
    window.sessionStorage.setItem(PENDING_DATE_OF_BIRTH_KEY, dateOfBirth);
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) { toast.error(result.error.message ?? `${provider === "apple" ? "Apple" : "Google"} sign-in failed`); setBusy(false); return; }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="bg-habitat flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <img src={logo} alt="Meutuals" className="mx-auto h-16 w-16 rounded-2xl" />
        <p className="label-mono text-muted-foreground mt-4 text-center">Meutuals</p>
        <h1 className="mt-2 text-center font-display text-3xl font-bold">Create your account.</h1>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">For socially curious adults, 21+.</p>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none" />
          </label>
          <label className="block">
            <span className="sr-only">Password</span>
            <PasswordField value={password} onChange={setPassword} placeholder="Password (8+ chars)" autoComplete="new-password" minLength={8} />
          </label>
          <label className="block">
            <span className="label-mono text-muted-foreground">Date of birth</span>
            <input
              type="date"
              required
              min={earliestReasonableDateOfBirth()}
              max={new Date().toISOString().slice(0, 10)}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
            />
          </label>
          <button disabled={busy} type="submit" className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" />
        </div>
        <button onClick={() => oauth("google")} disabled={busy}
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
          Continue with Google
        </button>
        <button onClick={() => oauth("apple")} disabled={busy}
          className="mt-2 w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
          Continue with Apple
        </button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account? <Link to="/login" className="font-semibold text-foreground underline">Sign in</Link>
        </p>
        <LegalFooter className="mt-6" />
      </div>
    </div>
  );
}
