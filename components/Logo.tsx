import Link from "next/link";
import { JDMark } from "./brand/JDMark";

/**
 * JDHub logo lockup: the JD mark + the wide, letter-spaced JDHUB wordmark.
 * `invert` swaps to the white tile and white type for dark backgrounds.
 */
export function Logo({ className = "", invert = false, markOnly = false }: { className?: string; invert?: boolean; markOnly?: boolean }) {
  return (
    <Link href="/" aria-label="JDHub home" className={`inline-flex shrink-0 items-center gap-2.5 ${className}`}>
      <JDMark size={32} variant={invert ? "light" : "dark"} />
      {!markOnly && (
        <span
          className={`display text-[20px] font-extrabold uppercase tracking-[0.14em] ${invert ? "text-white" : "text-ink"}`}
          style={{ fontStretch: "expanded" }}
        >
          JDHub
        </span>
      )}
    </Link>
  );
}
