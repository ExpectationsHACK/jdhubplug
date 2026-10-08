import { useId } from "react";
import type { ArtKind } from "@/lib/catalog";

// Product renders as clean vector illustrations. Real listings would swap these
// for photography shot on the same light-grey studio backdrop.

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function DeviceArt({
  kind,
  tint = "#2a2a2a",
  className,
}: {
  kind: ArtKind;
  tint?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const light = shade(tint, 0.18);
  const dark = shade(tint, -0.18);
  const body = `url(#${id}b)`;
  const screen = `url(#${id}s)`;

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3d66" />
          <stop offset="0.55" stopColor="#0d1424" />
          <stop offset="1" stopColor="#3b2a5c" />
        </linearGradient>
        <radialGradient id={`${id}sh`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="182" rx="62" ry="7" fill={`url(#${id}sh)`} />
      {art(kind, { body, screen, tint, light, dark })}
    </svg>
  );
}

type Paint = { body: string; screen: string; tint: string; light: string; dark: string };

function art(kind: ArtKind, p: Paint) {
  switch (kind) {
    case "phone":
      return (
        <g>
          {/* back, offset behind the front */}
          <rect x="88" y="22" width="68" height="150" rx="14" fill={p.body} />
          <rect x="96" y="30" width="30" height="34" rx="9" fill={p.dark} opacity="0.55" />
          <circle cx="106" cy="40" r="6" fill="#111" stroke={p.light} strokeWidth="2" />
          <circle cx="117" cy="54" r="6" fill="#111" stroke={p.light} strokeWidth="2" />
          {/* front */}
          <rect x="44" y="28" width="70" height="152" rx="15" fill={p.dark} />
          <rect x="48" y="32" width="62" height="144" rx="12" fill={p.screen} />
          <rect x="70" y="38" width="18" height="5" rx="2.5" fill="#000" />
          <circle cx="62" cy="150" r="22" fill="#fff" opacity="0.06" />
        </g>
      );
    case "earbuds":
      return (
        <g>
          <rect x="52" y="78" width="96" height="86" rx="30" fill="#fafafa" stroke="#dcdcdc" strokeWidth="2" />
          <path d="M52 112h96" stroke="#d6d6d6" strokeWidth="2" />
          <circle cx="100" cy="132" r="3" fill="#cfcfcf" />
          <g transform="translate(66 28) rotate(-12)">
            <ellipse cx="14" cy="16" rx="14" ry="15" fill="#fff" stroke="#ddd" strokeWidth="2" />
            <rect x="8" y="24" width="11" height="34" rx="5.5" fill="#fff" stroke="#ddd" strokeWidth="2" />
          </g>
          <g transform="translate(110 24) rotate(12)">
            <ellipse cx="14" cy="16" rx="14" ry="15" fill="#fff" stroke="#ddd" strokeWidth="2" />
            <rect x="9" y="24" width="11" height="34" rx="5.5" fill="#fff" stroke="#ddd" strokeWidth="2" />
          </g>
        </g>
      );
    case "charger":
      return (
        <g>
          <rect x="64" y="64" width="72" height="80" rx="16" fill="#fff" stroke="#dcdcdc" strokeWidth="2" />
          <rect x="91" y="98" width="18" height="8" rx="3" fill="#2b2b2b" />
          <rect x="84" y="40" width="7" height="26" rx="2" fill="#bdbdbd" />
          <rect x="109" y="40" width="7" height="26" rx="2" fill="#bdbdbd" />
          <path d="M100 144c0 20 10 30 34 30" stroke="#e2e2e2" strokeWidth="7" fill="none" strokeLinecap="round" />
        </g>
      );
    case "case":
      return (
        <g>
          <rect x="62" y="20" width="76" height="160" rx="18" fill={p.body} />
          <rect x="68" y="26" width="64" height="148" rx="14" fill="none" stroke={p.light} strokeWidth="1.5" opacity="0.6" />
          <rect x="72" y="32" width="34" height="38" rx="10" fill={p.dark} />
          <circle cx="100" cy="112" r="24" fill="none" stroke={p.light} strokeWidth="3" opacity="0.7" />
        </g>
      );
    case "powerbank":
      return (
        <g>
          <rect x="58" y="30" width="84" height="146" rx="16" fill={p.body} />
          <rect x="80" y="40" width="40" height="4" rx="2" fill={p.light} />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={82 + i * 12} cy="150" r="3" fill={i < 3 ? "#7CFFB2" : p.dark} />
          ))}
          <text x="100" y="108" textAnchor="middle" fontSize="15" fontWeight="700" fill={p.light} fontFamily="sans-serif">
            20000
          </text>
        </g>
      );
    case "laptop":
      return (
        <g>
          <rect x="34" y="40" width="132" height="90" rx="8" fill={p.body} />
          <rect x="40" y="46" width="120" height="78" rx="4" fill={p.screen} />
          <path d="M18 134h164l-8 14H26z" fill={p.body} />
          <rect x="84" y="134" width="32" height="5" rx="2.5" fill={p.dark} />
        </g>
      );
    case "tablet":
      return (
        <g>
          <rect x="46" y="22" width="108" height="156" rx="14" fill={p.body} />
          <rect x="52" y="28" width="96" height="144" rx="9" fill={p.screen} />
        </g>
      );
    case "watch":
      return (
        <g>
          <rect x="78" y="12" width="44" height="60" rx="10" fill={p.dark} />
          <rect x="78" y="128" width="44" height="60" rx="10" fill={p.dark} />
          <circle cx="100" cy="100" r="46" fill={p.body} />
          <circle cx="100" cy="100" r="38" fill={p.screen} />
          <path d="M100 76v24l16 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
          <rect x="144" y="90" width="7" height="20" rx="3" fill={p.light} />
        </g>
      );
    case "drone":
      return (
        <g>
          {[
            [44, 64],
            [156, 64],
            [44, 136],
            [156, 136],
          ].map(([x, y], i) => (
            <g key={i}>
              <path d={`M100 100L${x} ${y}`} stroke={p.dark} strokeWidth="8" strokeLinecap="round" />
              <ellipse cx={x} cy={y} rx="26" ry="5" fill={p.light} opacity="0.75" />
              <circle cx={x} cy={y} r="5" fill={p.dark} />
            </g>
          ))}
          <rect x="74" y="80" width="52" height="40" rx="14" fill={p.body} />
          <circle cx="100" cy="124" r="9" fill="#111" stroke={p.light} strokeWidth="2" />
        </g>
      );
    case "console":
      return (
        <g>
          <path d="M70 18c20 4 26 10 26 20v138c0 6-6 8-26 6z" fill="#fafafa" stroke="#dadada" strokeWidth="2" />
          <path d="M130 18c-20 4-26 10-26 20v138c0 6 6 8 26 6z" fill="#fafafa" stroke="#dadada" strokeWidth="2" />
          <rect x="94" y="22" width="12" height="160" rx="4" fill="#111" />
          <path d="M108 50h4" stroke="#3b82f6" strokeWidth="2" />
        </g>
      );
    case "camera":
      return (
        <g>
          <path d="M40 66h34l8-14h36l8 14h34a6 6 0 0 1 6 6v76a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6V72a6 6 0 0 1 6-6z" fill={p.body} />
          <circle cx="100" cy="110" r="36" fill={p.dark} stroke={p.light} strokeWidth="3" />
          <circle cx="100" cy="110" r="24" fill={p.screen} />
          <circle cx="92" cy="102" r="6" fill="#fff" opacity="0.25" />
          <rect x="140" y="74" width="16" height="8" rx="3" fill="#d33" />
        </g>
      );
    case "car":
      return (
        <g>
          <path
            d="M14 134v-18c0-6 4-10 10-11l26-5 22-22c4-4 9-6 15-6h40c6 0 11 2 15 6l22 22 12 3c6 2 10 7 10 13v18z"
            fill={p.body}
          />
          <path d="M60 100l18-18c3-3 6-4 10-4h22v22z" fill="#0e1625" opacity="0.85" />
          <path d="M116 78h12c4 0 7 1 10 4l18 18h-40z" fill="#0e1625" opacity="0.85" />
          <rect x="166" y="112" width="14" height="6" rx="3" fill="#ffd27a" />
          <rect x="16" y="114" width="10" height="6" rx="3" fill="#ff6b6b" />
          {[54, 146].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="136" r="20" fill="#151515" />
              <circle cx={cx} cy="136" r="10" fill="#9a9a9a" />
            </g>
          ))}
        </g>
      );
  }
}
