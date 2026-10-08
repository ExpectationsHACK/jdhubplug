import Link from "next/link";

/** JDHub wordmark: wide, heavy, letter-spaced caps. Works in black or white. */
export function Logo({ className = "", invert = false }: { className?: string; invert?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="JDHub home"
      className={`display inline-block text-[22px] font-extrabold uppercase tracking-[0.14em] ${
        invert ? "text-white" : "text-ink"
      } ${className}`}
      style={{ fontStretch: "expanded" }}
    >
      JDHub
    </Link>
  );
}
