"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ArtKind } from "@/lib/catalog";
import { DeviceArt } from "./DeviceArt";
import { Icon } from "./Icon";

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  bg: string;
  dark: boolean;
  art: { kind: ArtKind; tint: string }[];
  legal?: string;
};

const slides: Slide[] = [
  {
    eyebrow: "iPhone 15 Pro Max",
    title: "Graded Like New.\nPriced like it should be.",
    body: "IMEI-checked, battery-tested and escrow-protected. Graded units from every storage tier.",
    primary: { label: "Buy now", href: "/product/iphone-15-pro-max-1" },
    secondary: { label: "Learn more", href: "/trust#grading" },
    bg: "radial-gradient(120% 90% at 75% 50%, #2a2f3a 0%, #0b0d12 60%, #000 100%)",
    dark: true,
    art: [{ kind: "phone", tint: "#8a8378" }],
    legal: "*Price depends on grade and storage. Every unit escrow-protected.",
  },
  {
    eyebrow: "Sell",
    title: "Sell in minutes.\nGet paid in 48 hours.",
    body: "Tell us your model and condition. Get a locked cash offer, ship free or drop at a JDHub hub.",
    primary: { label: "Get an instant offer", href: "/sell" },
    secondary: { label: "How it works", href: "/sell#how" },
    bg: "linear-gradient(120deg, #0b2a8a 0%, #1a5cff 100%)",
    dark: true,
    art: [
      { kind: "phone", tint: "#2e4a6b" },
      { kind: "watch", tint: "#232323" },
    ],
  },
  {
    eyebrow: "Swap",
    title: "Trade up.\nPay only the difference.",
    body: "Trade in your iPhone 13 and pay only the difference on an iPhone 14. Swap phones, gadgets, even cars.",
    primary: { label: "Start a swap", href: "/swap" },
    secondary: { label: "See swap picks", href: "/shop/phones" },
    bg: "linear-gradient(180deg, #f4f4f4 0%, #e9ebee 100%)",
    dark: false,
    art: [
      { kind: "phone", tint: "#2e4a6b" },
      { kind: "phone", tint: "#1f2630" },
    ],
  },
  {
    eyebrow: "New category · Cars",
    title: "Drive away\nwith certainty.",
    body: "Every car VIN-checked with a 152-point inspection report. Financing and swap-up available.",
    primary: { label: "Shop cars", href: "/shop/cars" },
    secondary: { label: "Sell your car", href: "/sell" },
    bg: "radial-gradient(120% 100% at 70% 60%, #3b3f46 0%, #111 70%)",
    dark: true,
    art: [{ kind: "car", tint: "#9c9fa3" }],
  },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((n) => (n + 1) % slides.length), 6000);
    return () => clearTimeout(t);
  }, [i, playing]);

  const s = slides[i];
  const go = (d: number) => setI((n) => (n + d + slides.length) % slides.length);

  return (
    <section aria-roledescription="carousel" aria-label="Featured" className="relative overflow-hidden" style={{ background: s.bg }}>
      <div
        key={i}
        className={`wrap fade-in grid min-h-[560px] items-center gap-6 pb-20 pt-12 md:min-h-[640px] md:grid-cols-2 ${
          s.dark ? "text-white" : "text-ink"
        }`}
      >
        <div className="order-2 text-center md:order-1 md:text-left">
          <p className="mb-3 text-[16px] font-bold">{s.eyebrow}</p>
          <h1 className="display whitespace-pre-line text-[34px] md:text-[52px]">{s.title}</h1>
          <p className={`mt-4 max-w-md text-[16px] md:text-[18px] ${s.dark ? "text-white/80" : "text-ink-2"} mx-auto md:mx-0`}>
            {s.body}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            {s.secondary && (
              <Link href={s.secondary.href} className={`btn ${s.dark ? "btn-ghost-white" : "btn-outline"}`}>
                {s.secondary.label}
              </Link>
            )}
            <Link href={s.primary.href} className={`btn ${s.dark ? "btn-white" : "btn-primary"}`}>
              {s.primary.label}
            </Link>
          </div>
          {s.legal && <p className={`mt-6 text-[11px] ${s.dark ? "text-white/50" : "text-muted"}`}>{s.legal}</p>}
        </div>
        <div className="order-1 flex items-center justify-center md:order-2">
          {s.art.map((a, k) => (
            <DeviceArt
              key={k}
              kind={a.kind}
              tint={a.tint}
              className={
                a.kind === "car"
                  ? "h-64 w-full max-w-xl md:h-96"
                  : `h-56 w-56 md:h-[420px] md:w-[420px] ${k > 0 ? "-ml-24 md:-ml-40" : ""}`
              }
            />
          ))}
        </div>
      </div>

      {/* Indicators */}
      <div className={`absolute inset-x-0 bottom-6 flex items-center justify-center gap-3 ${s.dark ? "text-white" : "text-ink"}`}>
        <button aria-label="Previous slide" onClick={() => go(-1)} className="hidden p-1 md:block">
          <Icon name="chevronLeft" size={20} />
        </button>
        {slides.map((sl, k) => (
          <button
            key={k}
            aria-label={`Go to slide ${k + 1}: ${sl.eyebrow}`}
            aria-current={k === i}
            onClick={() => setI(k)}
            className={`h-2 rounded-full transition-all ${k === i ? "w-8 bg-current" : "w-2 bg-current opacity-35"}`}
          />
        ))}
        <button aria-label={playing ? "Pause carousel" : "Play carousel"} onClick={() => setPlaying((p) => !p)} className="p-1">
          <Icon name={playing ? "pause" : "play"} size={18} />
        </button>
        <button aria-label="Next slide" onClick={() => go(1)} className="hidden p-1 md:block">
          <Icon name="chevronRight" size={20} />
        </button>
      </div>
    </section>
  );
}
