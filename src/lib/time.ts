export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

/** Human-readable relative time for sentence-style surfaces. */
export function timeAgoLabel(iso: string): string {
  const value = timeAgo(iso);
  if (!value || value === "now") return value;
  return /^\d+[smhd]$/.test(value) ? `${value} ago` : value;
}
