// JDHub line icon set: 24px grid, 1.5px stroke, round caps and joins, no fills.
// Kept deliberately thin and geometric to match the minimal monochrome UI.

const paths: Record<string, React.ReactNode> = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2.2l2.1 11h11.2l2-8H6.3" />
      <circle cx="9" cy="19.5" r="1.2" />
      <circle cx="17" cy="19.5" r="1.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" />
    </>
  ),
  menu: <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />,
  close: <path d="m5.5 5.5 13 13m0-13-13 13" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  arrowRight: <path d="M4 12h15m-6-6 6 6-6 6" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M8.5 5.5v13m7-13v13" />,
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.1 7.5 9.5 4.4-1.4 7.5-4.9 7.5-9.5V6z" />
      <path d="m8.8 12 2.2 2.2 4.3-4.4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.2 2.6 2.6 4.9-5" />
    </>
  ),
  swap: <path d="M4 8.5h14.5M15 5l3.5 3.5L15 12M20 15.5H5.5M9 12l-3.5 3.5L9 19" />,
  tag: (
    <>
      <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0z" />
      <circle cx="8" cy="8" r="1.3" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5V16h-7" />
      <circle cx="6.5" cy="17.5" r="1.7" />
      <circle cx="17" cy="17.5" r="1.7" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  verified: (
    <>
      <path d="m12 2.8 2.3 1.7 2.8-.2.9 2.7 2.4 1.5-.9 2.7.9 2.7-2.4 1.5-.9 2.7-2.8-.2L12 19.6l-2.3-1.7-2.8.2-.9-2.7-2.4-1.5.9-2.7-.9-2.7 2.4-1.5.9-2.7 2.8.2z" />
      <path d="m8.8 11.3 2.2 2.2 4.3-4.3" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="7.5" width="17" height="9" rx="2" />
      <path d="M21.5 10.5v3M5.5 10.5v3M8.5 10.5v3M11.5 10.5v3" />
    </>
  ),
  scan: (
    <>
      <path d="M3.5 8V4.5h3.5M17 4.5h3.5V8M20.5 16v3.5H17M7 19.5H3.5V16" />
      <path d="M7.5 9v6M10 9v6M12.5 9v6M15 9v6M17 9v6" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3.5" y="14" width="4" height="6.5" rx="1.5" />
      <rect x="16.5" y="14" width="4" height="6.5" rx="1.5" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="5" width="15" height="10.5" rx="1.2" />
      <path d="M2 18.5h20" />
    </>
  ),
  car: (
    <>
      <path d="M3.5 16.5v-4l2-5a1.5 1.5 0 0 1 1.4-1h10.2a1.5 1.5 0 0 1 1.4 1l2 5v4z" />
      <path d="M3.5 12.5h17" />
      <circle cx="7.5" cy="16.5" r="1.8" />
      <circle cx="16.5" cy="16.5" r="1.8" />
    </>
  ),
  watch: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="3" />
      <path d="M9 6.5 9.5 2.5h5l.5 4M9 17.5l.5 4h5l.5-4M12 9.5V12l1.5 1.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="0.8" />
      <path d="M5 12v8.5h14V12M12 8v12.5M12 8S10.5 3.5 8 4.2 8.5 8 12 8zm0 0s1.5-4.5 4-3.8S15.5 8 12 8z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.4" />
    </>
  ),
  filter: <path d="M4 6.5h16M7 12h10M10 17.5h4" />,
  heart: <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" />,
  store: (
    <>
      <path d="M4 9.5V20h16V9.5M3 9.5 4.5 4h15L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7h14.5a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M4 7.5V6a1.5 1.5 0 0 1 1.8-1.5L16 6.5M15.5 13.5h1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17v.3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" />
    </>
  ),
  chat: <path d="M4 18.5V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v9a1.5 1.5 0 0 1-1.5 1.5H8z" />,
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 24,
  className,
  strokeWidth = 1.5,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {paths[name]}
    </svg>
  );
}

/** WhatsApp glyph is a filled brand mark, so it lives outside the line set. */
export function WhatsAppGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden fill="currentColor">
      <path d="M16 3.2A12.7 12.7 0 0 0 5.1 22.5L3.3 28.8l6.5-1.7A12.7 12.7 0 1 0 16 3.2zm0 23.2a10.5 10.5 0 0 1-5.4-1.5l-.4-.2-3.9 1 1-3.8-.2-.4A10.5 10.5 0 1 1 16 26.4zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.6 8.6 0 0 1-4.3-3.7c-.3-.6.3-.5.9-1.7a.6.6 0 0 0 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.9.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.2-.3-.3-.7-.4z" />
    </svg>
  );
}
