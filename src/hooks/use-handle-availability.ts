import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkHandleAvailable } from "@/lib/profile.functions";

export type HandleAvailability = "idle" | "checking" | "available" | "taken" | "error";

const DEBOUNCE_MS = 450;

/**
 * Debounced live availability check for a @handle field, shared between
 * Onboarding and the profile-edit modal. `currentHandle` is the caller's own
 * existing handle (if any) - typing back to it resolves instantly as
 * "available" without a round trip, which is the single most common no-op
 * edit (open Edit profile, change something else, save).
 */
export function useHandleAvailability(
  handle: string,
  valid: boolean,
  currentHandle?: string | null,
): HandleAvailability {
  const [status, setStatus] = useState<HandleAvailability>("idle");
  const check = useServerFn(checkHandleAvailable);
  // Guards against a slower earlier request resolving after a newer one -
  // only the most recently fired check is allowed to set state.
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1;
    const thisRequest = requestId.current;

    if (!valid) {
      setStatus("idle");
      return;
    }
    if (currentHandle && handle === currentHandle) {
      setStatus("available");
      return;
    }

    setStatus("checking");
    const timer = window.setTimeout(() => {
      void check({ data: { handle } })
        .then((result) => {
          if (requestId.current !== thisRequest) return;
          setStatus(result.available ? "available" : "taken");
        })
        .catch(() => {
          if (requestId.current !== thisRequest) return;
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [handle, valid, currentHandle, check]);

  return status;
}

/** Shared copy for the @handle field's hint line, so Onboarding and the
 *  profile-edit modal read identically. */
export function handleFieldHint(
  handle: string,
  valid: boolean,
  availability: HandleAvailability,
): string {
  if (!handle) return "Letters, numbers, underscore";
  if (!valid) return "Use at least 3 characters";
  switch (availability) {
    case "checking":
      return "Checking availability…";
    case "taken":
      return "Already taken";
    case "error":
      return "Couldn't check right now";
    case "available":
    case "idle":
    default:
      return `@${handle}`;
  }
}

export function handleFieldHintTone(
  availability: HandleAvailability,
): "muted" | "success" | "danger" {
  if (availability === "taken") return "danger";
  if (availability === "available") return "success";
  return "muted";
}
