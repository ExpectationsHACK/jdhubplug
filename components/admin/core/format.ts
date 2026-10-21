// Formatting helpers for the admin core. Isomorphic, and deliberately free of
// lib/catalog imports so client components don't pull the seed catalog into the bundle.

const NAIRA = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

/** ₦1,185,000 */
export const naira = (n: number) => NAIRA.format(Math.round(n));

/** ₦1.2M, ₦450K, ₦900. For chart axes and tight tiles. */
export function nairaCompact(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number, suffix: string) => `${sign}₦${(Math.round(v * 10) / 10).toLocaleString("en-NG")}${suffix}`;
  if (abs >= 1_000_000_000) return fmt(abs / 1_000_000_000, "B");
  if (abs >= 1_000_000) return fmt(abs / 1_000_000, "M");
  if (abs >= 1_000) return fmt(abs / 1_000, "K");
  return `${sign}₦${Math.round(abs).toLocaleString("en-NG")}`;
}

export const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;

/** Nigeria (WAT) is UTC+1 all year, so a fixed offset gives the local calendar day. */
const WAT_OFFSET_MS = 60 * 60 * 1000;

/** "2026-10-08" for the Lagos calendar day containing `ms`. */
export const lagosDay = (ms: number) => new Date(ms + WAT_OFFSET_MS).toISOString().slice(0, 10);

/** Start of the Lagos calendar day containing `ms`, as a UTC timestamp. */
export function lagosDayStart(ms: number) {
  const shifted = ms + WAT_OFFSET_MS;
  return shifted - (((shifted % 86_400_000) + 86_400_000) % 86_400_000) - WAT_OFFSET_MS;
}

/** "Thu 8 Oct" for a Lagos day key. */
export function dayLabel(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-NG", { ...opts, timeZone: "UTC" });
}

// Dates rendered by client components hydrate against server HTML, so pin the time
// zone (servers run in UTC, buyers and staff are in Lagos) to keep both renders identical.

/** "8 Oct 2026, 14:05" in Lagos time. */
export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

/** "just now", "5m ago", "3h ago", "2d ago", then a Lagos date. */
export function ago(iso: string, now: number) {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
