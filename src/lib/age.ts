export const MINIMUM_AGE = 21;
export const AGE_RETRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const AGE_RETRY_KEY = "meutuals.age-retry-after";
export const PENDING_DATE_OF_BIRTH_KEY = "meutuals.pending-date-of-birth";

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function latestEligibleDateOfBirth(today = new Date()) {
  const date = new Date(today.getFullYear() - MINIMUM_AGE, today.getMonth(), today.getDate());
  return dateInputValue(date);
}

export function earliestReasonableDateOfBirth(today = new Date()) {
  const date = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  return dateInputValue(date);
}

export function isPlausibleDateOfBirth(value: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }
  return value >= earliestReasonableDateOfBirth(today) && value <= dateInputValue(today);
}

export function isEligibleDateOfBirth(value: string, today = new Date()) {
  return isPlausibleDateOfBirth(value, today) && value <= latestEligibleDateOfBirth(today);
}

export function ageRetryAfter() {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(AGE_RETRY_KEY));
  return Number.isFinite(value) && value > Date.now() ? value : 0;
}

export function lockAgeRetry() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGE_RETRY_KEY, String(Date.now() + AGE_RETRY_COOLDOWN_MS));
}
