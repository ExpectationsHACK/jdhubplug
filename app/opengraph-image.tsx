import { ImageResponse } from "next/og";

// Default social card (home page and any page without its own image). Product
// pages override it with the product photo.
export const alt = "JDHub: buy, sell and swap graded phones, gadgets and cars in Nigeria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#fff",
          background: "radial-gradient(120% 90% at 50% 10%, #1c2645 0%, #080b14 55%, #000 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="15" fill="#fff" />
            <g transform="translate(1 0)" fill="none" stroke="#000" strokeWidth="7" strokeLinejoin="round">
              <path d="M14 18H35A14 14 0 0 1 35 46H20A7 7 0 0 1 13 39" />
              <path d="M27 18V46" />
            </g>
            <circle cx="39" cy="32" r="4.5" fill="#1a5cff" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 8 }}>JDHUB</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>Trade with certainty.</div>
          <div style={{ marginTop: 24, fontSize: 34, color: "rgba(255,255,255,0.72)" }}>
            Graded phones, gadgets and cars. Escrow on every order.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "rgba(255,255,255,0.6)" }}>
          {["Buy graded", "Sell in minutes", "Swap & trade up", "Nigeria"].map((t) => (
            <div key={t} style={{ display: "flex", padding: "10px 22px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
