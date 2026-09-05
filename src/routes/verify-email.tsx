import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { LegalFooter } from "@/components/mutuals/LegalFooter";
import logo from "@/assets/logo.png";

type Search = { email?: string };

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verify your email · MEUTUALS — Your tribe is waiting" },
      {
        name: "description",
        content:
          "Check whether your MEUTUALS email address is verified, resend the confirmation link, and see what to do next.",
      },
      { property: "og:title", content: "Verify your email · MEUTUALS — Your tribe is waiting" },
      {
        property: "og:description",
        content: "Confirm your MEUTUALS email address or resend the verification link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyEmailPage,
});

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);

  const verified = !!user?.email_confirmed_at;

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email.trim()) {
      toast.error("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast.success("Verification email sent", {
      description: "It can take a minute to arrive. Check spam too.",
    });
  };

  const recheck = async () => {
    setChecking(true);
    const { data, error } = await supabase.auth.refreshSession();
    setChecking(false);
    if (error && !data.session) {
      toast.error("Still not verified — open the link in your email first.");
      return;
    }
    if (data.user?.email_confirmed_at) {
      toast.success("Email verified");
      navigate({ to: "/" });
      return;
    }
    toast.error("Not verified yet. Open the link in your email, then try again.");
  };

  return (
    <div className="bg-habitat flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <img src={logo} alt="MEUTUALS" className="mx-auto h-16 w-16 rounded-2xl" />
        <p className="label-mono text-muted-foreground mt-4 text-center">MEUTUALS</p>

        {loading ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Checking your account…</p>
        ) : verified ? (
          <>
            <h1 className="mt-2 text-center font-display text-3xl font-bold">You're verified.</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {user?.email} is confirmed. You're all set.
            </p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-8 w-full rounded-2xl bg-meutuals-gradient py-3.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Continue to MEUTUALS
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-center font-display text-3xl font-bold">Verify your email.</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {user
                ? "Your address isn't confirmed yet."
                : "We sent a confirmation link to your inbox."}
            </p>

            <ol className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
              <li className="flex gap-3">
                <span className="label-mono text-muted-foreground">1</span>
                <span>Open the email from MEUTUALS and tap the confirmation link.</span>
              </li>
              <li className="flex gap-3">
                <span className="label-mono text-muted-foreground">2</span>
                <span>No email? Check spam or promotions — it can take a minute.</span>
              </li>
              <li className="flex gap-3">
                <span className="label-mono text-muted-foreground">3</span>
                <span>Still nothing? Resend the link below, then sign in.</span>
              </li>
            </ol>

            <label className="mt-6 block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
            </label>

            <button
              onClick={resend}
              disabled={busy || cooldown > 0}
              className="mt-3 w-full rounded-2xl bg-meutuals-gradient py-3.5 text-sm font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
            >
              {busy
                ? "Sending…"
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend verification email"}
            </button>

            <button
              onClick={recheck}
              disabled={checking}
              className="mt-2 w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
            >
              {checking ? "Checking…" : "I've verified — check again"}
            </button>
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/login" className="font-semibold text-foreground underline">
            Back to sign in
          </Link>
        </p>
        <LegalFooter className="mt-6" />
      </div>
    </div>
  );
}
