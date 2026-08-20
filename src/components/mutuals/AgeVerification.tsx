import { useState } from "react";
import { CalendarDays, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useVerifyAge } from "@/lib/profile-store";
import {
  earliestReasonableDateOfBirth,
  isEligibleDateOfBirth,
  PENDING_DATE_OF_BIRTH_KEY,
} from "@/lib/age";

function pendingDateOfBirth() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PENDING_DATE_OF_BIRTH_KEY) ?? "";
}

export function AgeVerification({ locked = false }: { locked?: boolean }) {
  const { signOut } = useAuth();
  const verifyAge = useVerifyAge();
  const [dateOfBirth, setDateOfBirth] = useState(pendingDateOfBirth);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dateOfBirth) return;

    verifyAge.mutate(dateOfBirth, {
      onSuccess: () => {
        window.sessionStorage.removeItem(PENDING_DATE_OF_BIRTH_KEY);
        toast.success("Age verified.");
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  return (
    <main className="bg-habitat flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <CalendarDays className="h-5 w-5" />
        </span>
        <p className="label-mono mt-5 text-muted-foreground">Age assurance</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight">
          {locked ? "This account isn’t eligible." : "Confirm your date of birth."}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {locked
            ? "The first date submitted for this account did not meet the minimum age requirement. It cannot be replaced with a different date."
            : "MEUTUALS includes direct messages and real-world meetups, so age verification is required before entering the app."}
        </p>

        {!locked && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label-mono text-muted-foreground">Date of birth</span>
              <input
                type="date"
                required
                min={earliestReasonableDateOfBirth()}
                max={new Date().toISOString().slice(0, 10)}
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={!dateOfBirth || verifyAge.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {verifyAge.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>

        {!locked && dateOfBirth && !isEligibleDateOfBirth(dateOfBirth) && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Eligibility is determined securely when you continue.
          </p>
        )}
      </section>
    </main>
  );
}
