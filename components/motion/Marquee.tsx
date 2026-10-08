import type { CSSProperties, ReactNode } from "react";

/**
 * Infinite horizontal band. Content is rendered twice and the track slides by half
 * its width, so the loop is seamless. Pauses on hover and focus; under reduced
 * motion it becomes a plain scrollable row.
 */
export function Marquee({
  children,
  seconds = 40,
  reverse = false,
  className = "",
  label,
}: {
  children: ReactNode;
  seconds?: number;
  reverse?: boolean;
  className?: string;
  label: string;
}) {
  return (
    <section aria-label={label} className={`marquee ${className}`} style={{ "--marquee-s": `${seconds}s` } as CSSProperties}>
      <div className={`marquee-track ${reverse ? "marquee-reverse" : ""}`}>
        <div className="marquee-group">{children}</div>
        <div className="marquee-group" aria-hidden inert>
          {children}
        </div>
      </div>
    </section>
  );
}
