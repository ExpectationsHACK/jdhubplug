import { Icon } from "../Icon";

// Star rating display. Hook-free, so it renders in server and client components.

/** Five stars filled to `value` (0–5, fractions allowed). */
export function Stars({ value, size = 14, className = "" }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (cls: string) => (
    <span className={`flex ${cls}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name="star" size={size} strokeWidth={1.25} className="shrink-0 fill-current" />
      ))}
    </span>
  );
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className={`relative inline-flex align-[-2px] ${className}`}>
      {row("text-line")}
      <span aria-hidden className="absolute inset-y-0 left-0 overflow-hidden text-ink" style={{ width: `${pct}%` }}>
        {row("")}
      </span>
    </span>
  );
}

/** "★★★★☆ 4.3 (12)" for cards and the buy box. Renders nothing without reviews. */
export function RatingInline({ summary, size = 13, className = "" }: { summary?: { count: number; average: number }; size?: number; className?: string }) {
  if (!summary || summary.count <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Stars value={summary.average} size={size} />
      <span className="font-bold text-ink">{summary.average.toFixed(1)}</span>
      <span>
        ({summary.count}
        <span className="sr-only"> verified review{summary.count === 1 ? "" : "s"}</span>)
      </span>
    </span>
  );
}
