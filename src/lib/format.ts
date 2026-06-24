// Small presentational helpers for the feed (Module 2B).
// Pure functions only — safe to import from server or client components.

/** Compact count like Twitter: 1.2K, 34, 156. */
export function fmtCount(n: number): string {
  if (n >= 1000) {
    const v = (n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0).replace(/\.0$/, "");
    return `${v}K`;
  }
  return String(n);
}

/**
 * Relative timestamp like the design ("30s", "5h", "1d"); falls back to an
 * absolute short date once a tweet is older than a week.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;

  const d = new Date(then);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Absolute timestamp for the focused tweet, e.g. "2:14 PM · Jun 9, 2026". */
export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${time} · ${date}`;
}

/** Up to two initials from a display name, e.g. "Md Shahriar Alam" → "MS". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Avatar palette pulled from the Brief 2 mockups (blue / purple / green / red / pink / orange).
const AVATAR_COLORS = [
  "#1D9BF0",
  "#7856FF",
  "#00BA7C",
  "#F4212E",
  "#F91880",
  "#FF7A00",
  "#FFD400",
  "#E0245E",
];

/** Deterministic avatar color from a stable seed (handle or id). */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
