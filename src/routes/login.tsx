import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { LegalFooter } from "@/components/mutuals/LegalFooter";
import logo from "@/assets/logo.png";
import { PasswordField } from "@/components/mutuals/PasswordField";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const finishSignIn = () => {
    const requested = window.sessionStorage.getItem("meutuals:post-login-path");
    window.sessionStorage.removeItem("meutuals:post-login-path");
    if (requested?.startsWith("/") && !requested.startsWith("//")) {
      window.location.assign(requested);
      return;
    }
    navigate({ to: "/" });
  };

  useEffect(() => {
    if (!loading && user) finishSignIn();
    // finishSignIn intentionally reads one-time browser state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (/confirm/i.test(error.message)) {
        toast.error("Email not verified yet");
        navigate({ to: "/verify-email", search: { email } });
        return;
      }
      toast.error(error.message);
      return;
    }
    finishSignIn();
  };

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(
        result.error.message ?? `${provider === "apple" ? "Apple" : "Google"} sign-in failed`,
      );
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    finishSignIn();
  };

  return (
    <div className="bg-habitat flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <img src={logo} alt="Meutuals" className="mx-auto h-16 w-16 rounded-2xl" />
        <p className="label-mono text-muted-foreground mt-4 text-center">Meutuals</p>
        <h1 className="mt-2 text-center font-display text-3xl font-bold">Welcome back.</h1>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="Password"
            autoComplete="current-password"
          />
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-2xl bg-meutuals-gradient py-3.5 text-sm font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          OR
          <span className="h-px flex-1 bg-border" />
        </div>
        <button
          onClick={() => oauth("google")}
          disabled={busy}
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          Continue with Google
        </button>
        <button
          onClick={() => oauth("apple")}
          disabled={busy}
          className="mt-2 w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          Continue with Apple
        </button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-foreground underline">
            Sign up
          </Link>
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          <Link to="/reset-password" className="underline">
            Forgot password?
          </Link>
        </p>
        <LegalFooter className="mt-6" />
      </div>
    </div>
  );
}
