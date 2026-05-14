import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { LegalFooter } from "@/components/mutuals/LegalFooter";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your email", { description: "Confirm your address to finish signup." });
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error(result.error.message ?? "Google sign-in failed"); setBusy(false); return; }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="bg-habitat flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <img src={logo} alt="Mutuals" className="mx-auto h-16 w-16 rounded-2xl" />
        <p className="label-mono text-muted-foreground mt-4 text-center">Mutuals</p>
        <h1 className="mt-2 text-center font-display text-3xl font-bold">Create your account.</h1>
        <p className="mt-1 text-center text-[11px] text-muted-foreground">For socially curious adults, 21+.</p>
        <form onSubmit={submit} className="mt-8 space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none" />
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ chars)"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none" />
          <button disabled={busy} type="submit" className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" />
        </div>
        <button onClick={google} disabled={busy}
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50">
          Continue with Google
        </button>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account? <Link to="/login" className="font-semibold text-foreground underline">Sign in</Link>
        </p>
        <LegalFooter className="mt-6" />
      </div>
    </div>
  );
}
