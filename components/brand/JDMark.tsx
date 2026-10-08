// The JDHub mark: a "JD" ligature on a rounded tile. The J's top serif, stem and
// hook share one stroke with the D's bowl, and the blue dot inside the D is the
// "hub" — the point where buyers, sellers and swappers meet.
//
// Geometry lives on a 64×64 grid so it stays crisp from a 16px favicon up.

export const JD_MARK_PATHS = {
  /** D bowl + bottom bar + J hook, as one continuous stroke. */
  outer: "M14 18H35A14 14 0 0 1 35 46H20A7 7 0 0 1 13 39",
  /** Shared J/D stem. */
  stem: "M27 18V46",
  hub: { cx: 38, cy: 32, r: 4.5 },
  strokeWidth: 7,
} as const;

export function JDMark({
  size = 32,
  variant = "dark",
  className,
  title,
}: {
  size?: number;
  /** dark: black tile, white glyph (default). light: white tile, black glyph. bare: glyph only, currentColor. */
  variant?: "dark" | "light" | "bare";
  className?: string;
  title?: string;
}) {
  const tile = variant === "dark" ? "#000" : variant === "light" ? "#fff" : "none";
  const glyph = variant === "dark" ? "#fff" : variant === "light" ? "#000" : "currentColor";
  const p = JD_MARK_PATHS;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {variant !== "bare" && <rect width="64" height="64" rx="15" fill={tile} />}
      <g transform="translate(1 0)" fill="none" stroke={glyph} strokeWidth={p.strokeWidth} strokeLinejoin="round">
        <path d={p.outer} />
        <path d={p.stem} />
      </g>
      <circle cx={p.hub.cx + 1} cy={p.hub.cy} r={p.hub.r} fill="#1a5cff" />
    </svg>
  );
}
