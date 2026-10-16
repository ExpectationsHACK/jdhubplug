import { formatNaira } from "@/lib/reference";
import { Icon } from "../Icon";

/** Progress towards free delivery. Renders nothing when free delivery is switched off. */
export function FreeDeliveryMeter({ subtotal, threshold, className = "" }: { subtotal: number; threshold: number; className?: string }) {
  if (!threshold || threshold <= 0) return null;
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const done = left === 0;
  return (
    <div className={className}>
      <p className="flex items-center gap-2 text-[13px]" aria-live="polite">
        <Icon name="truck" size={18} className={done ? "text-accent" : ""} />
        {done ? (
          <span className="font-bold">You&apos;ve unlocked free delivery.</span>
        ) : (
          <span>
            Add <span className="font-bold">{formatNaira(left)}</span> for free delivery
          </span>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Progress to free delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div className={`jdc-bar h-full rounded-full ${done ? "bg-accent" : "bg-ink"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
