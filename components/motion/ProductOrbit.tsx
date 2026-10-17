"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Product } from "@/lib/types";
import { ProductImage } from "../ProductImage";
import { shortNaira } from "../home/format";
import { Icon } from "../Icon";
import { Magnetic } from "./Magnetic";
import { prefersReducedMotion } from "./useMotion";

// "Product orbit" hero: real product photos float on a 3D ring around the headline.
//
// Geometry lives in CSS variables (--r radius, --k ring tilt, --card width) that change
// per breakpoint, so the server-rendered ring is already in place before hydration.
// After hydration a single requestAnimationFrame loop spins the ring: it writes one
// transform, one overlay opacity and (rarely) a z-index per card — compositor-only
// properties, no layout. Drag/swipe spins it with inertia, the pointer tilts it,
// focusing a card brings it to the front, and the pause button stops all motion.
// Under prefers-reduced-motion the ring is replaced by a static photo grid (CSS).

export type OrbitProduct = Pick<Product, "id" | "name" | "price" | "photo" | "imageUrl" | "art" | "tint">;

const MESSAGES = [
  {
    word: "Buy graded.",
    sub: "IMEI-checked, battery-tested and escrow-protected. Every unit graded on one standard.",
    cta: { label: "Shop now", href: "/shop" },
  },
  {
    word: "Sell in minutes.",
    sub: "Tell us the model and condition. Get a locked cash offer, paid within 48 hours.",
    cta: { label: "Get an offer", href: "/sell" },
  },
  {
    word: "Swap & trade up.",
    sub: "Trade in what you have and pay only the difference. Phones, gadgets, even cars.",
    cta: { label: "Start a swap", href: "/swap" },
  },
  {
    word: "Cars, checked.",
    sub: "VIN-checked cars with a 152-point inspection report. Drive away with certainty.",
    cta: { label: "Shop cars", href: "/shop/cars" },
  },
];

const AUTO_SPEED = 0.11; // degrees per frame at 60fps
const DEG = Math.PI / 180;

/** Card placement for a ring angle. Shared by the server render and the animation loop. */
function place(phiDeg: number) {
  const s = Math.sin(phiDeg * DEG);
  const c = Math.cos(phiDeg * DEG);
  return {
    transform: `translate3d(calc(var(--r) * ${s.toFixed(4)}), calc(var(--r) * var(--k) * ${c.toFixed(4)}), calc(var(--r) * var(--rz) * ${c.toFixed(4)})) rotateY(${(-s * 18).toFixed(2)}deg)`,
    shade: ((1 - c) / 2) * 0.82,
    z: Math.round(c * 100) + 100,
    sheen: s,
  };
}

export function ProductOrbit({ products }: { products: OrbitProduct[] }) {
  const items = products.slice(0, 12);
  const step = 360 / Math.max(items.length, 1);
  const [msg, setMsg] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const pausedRef = useRef(false);
  const state = useRef({
    angle: 0,
    velocity: 0,
    hover: false,
    dragging: false,
    moved: false,
    startX: 0,
    startAngle: 0,
    lastX: 0,
    lastT: 0,
    target: null as number | null,
    tiltX: 0,
    tiltY: 0,
    goalX: 0,
    goalY: 0,
    perPx: 0.22,
    z: [] as number[],
  });

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Headline word swap.
  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const t = setTimeout(() => {
      setPrev(msg);
      setMsg((m) => (m + 1) % MESSAGES.length);
    }, 3800);
    return () => clearTimeout(t);
  }, [msg, paused]);

  // The ring.
  useEffect(() => {
    const hero = heroRef.current;
    const stage = stageRef.current;
    if (!hero || !stage || prefersReducedMotion()) return;
    const st = state.current;
    let raf = 0;
    let running = false;

    const measure = () => {
      const r = parseFloat(getComputedStyle(hero).getPropertyValue("--r")) || 400;
      // Dragging the full width of the ring turns it about half a revolution.
      st.perPx = 180 / (Math.PI * r);
    };
    measure();

    const frame = () => {
      const auto = pausedRef.current ? 0 : st.hover ? AUTO_SPEED * 0.15 : AUTO_SPEED;
      if (st.target !== null) {
        const d = st.target - st.angle;
        st.angle += d * 0.12;
        st.velocity = 0;
        if (Math.abs(d) < 0.05) st.target = null;
      } else if (!st.dragging) {
        // Inertia decays back toward the gentle auto-rotation.
        st.velocity = st.velocity * 0.95 + auto * 0.05;
        st.angle += st.velocity;
      }
      st.tiltX += (st.goalX - st.tiltX) * 0.06;
      st.tiltY += (st.goalY - st.tiltY) * 0.06;

      stage.style.perspectiveOrigin = `${50 + st.tiltX * 14}% ${42 + st.tiltY * 12}%`;
      stage.style.setProperty("--k-tilt", (st.tiltY * 0.1).toFixed(3));
      if (copyRef.current) copyRef.current.style.transform = `translate3d(${(st.tiltX * -10).toFixed(1)}px, ${(st.tiltY * -6).toFixed(1)}px, 0)`;

      for (let i = 0; i < cardRefs.current.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const p = place(st.angle + i * step);
        el.style.transform = p.transform;
        el.style.setProperty("--shade", p.shade.toFixed(3));
        el.style.setProperty("--sheen", p.sheen.toFixed(3));
        if (st.z[i] !== p.z) {
          st.z[i] = p.z;
          el.style.zIndex = String(p.z);
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // Only animate while the hero is on screen and the tab is visible.
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen && !document.hidden) start();
      else stop();
    });
    io.observe(hero);
    const onVis = () => (document.hidden || !onScreen ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", measure);
    start();

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  // ---- Pointer: drag to spin, move to tilt.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const st = state.current;
    st.dragging = true;
    st.moved = false;
    st.target = null;
    st.startX = st.lastX = e.clientX;
    st.startAngle = st.angle;
    st.lastT = performance.now();
    st.velocity = 0;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = state.current;
    if (e.pointerType === "mouse") {
      const r = heroRef.current!.getBoundingClientRect();
      st.goalX = (e.clientX - r.left) / r.width - 0.5;
      st.goalY = (e.clientY - r.top) / r.height - 0.5;
    }
    if (!st.dragging) return;
    const dx = e.clientX - st.startX;
    if (!st.moved && Math.abs(dx) > 6) {
      st.moved = true;
      // Capture only once it's a real drag, so plain clicks still reach the card links.
      stageRef.current?.setPointerCapture(e.pointerId);
    }
    if (!st.moved) return;
    const now = performance.now();
    const dt = Math.max(1, now - st.lastT);
    const v = ((e.clientX - st.lastX) * st.perPx) / dt; // degrees per ms
    st.velocity = v * 16.7; // degrees per frame
    st.lastX = e.clientX;
    st.lastT = now;
    st.angle = st.startAngle + dx * st.perPx;
  };
  const endDrag = () => {
    const st = state.current;
    st.dragging = false;
    st.velocity = Math.max(-8, Math.min(8, st.velocity));
  };

  const bringToFront = (i: number) => {
    const st = state.current;
    // Nearest angle at which card i sits at the front (phi = 0).
    const goal = -i * step;
    const turns = Math.round((st.angle - goal) / 360);
    st.target = goal + turns * 360;
  };

  const current = MESSAGES[msg];

  return (
    <section
      ref={heroRef}
      aria-label="Featured products"
      className="orbit-hero"
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        state.current.goalX = 0;
        state.current.goalY = 0;
      }}
    >
      <div aria-hidden className="orbit-glow" />

      <div
        ref={stageRef}
        className="orbit-stage"
        onPointerDown={onPointerDown}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={() => (state.current.hover = true)}
        onPointerLeave={() => (state.current.hover = false)}
        onClickCapture={(e) => {
          // A drag that ends on a card is a spin, not a click.
          if (state.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            state.current.moved = false;
          }
        }}
      >
        <ul className="orbit-ring" aria-label="Spin to browse featured products">
          {items.map((p, i) => {
            const pl = place(i * step);
            return (
              <li
                key={p.id}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className="orbit-card"
                style={{ transform: pl.transform, zIndex: pl.z, "--shade": pl.shade, "--sheen": pl.sheen } as CSSProperties}
              >
                <Link
                  href={`/product/${p.id}`}
                  draggable={false}
                  onFocus={() => bringToFront(i)}
                  aria-label={`${p.name}, ${shortNaira(p.price)}`}
                  className="orbit-link"
                >
                  <span className="orbit-tile">
                    <ProductImage item={p} width={500} priority={i < 6} className="h-full w-full" artClassName="h-4/5 w-4/5" />
                    <span aria-hidden className="orbit-gloss" />
                    <span aria-hidden className="orbit-shade" />
                  </span>
                  <span aria-hidden className="orbit-reflect">
                    <ProductImage item={p} width={500} className="h-full w-full" artClassName="h-4/5 w-4/5" />
                  </span>
                  <span className="orbit-label">
                    <span className="block truncate">{p.name}</span>
                    <span className="block text-white/60">{shortNaira(p.price)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div ref={copyRef} className="orbit-copy">
        <p className="orbit-eyebrow">Phones · Gadgets · Cars · Nigeria</p>
        <h1 className="display orbit-title">
          <span className="sr-only">Buy graded. Sell in minutes. Swap and trade up. Cars, checked. </span>
          <span aria-hidden className="swap-stack">
            {MESSAGES.map((m, i) => (
              <span key={m.word} className={`swap-word ${i === msg ? "is-active" : i === prev ? "was-active" : ""}`}>
                {m.word.split(" ").map((w, wi, all) => (
                  <Fragment key={wi}>
                    <span className="swap-chunk">
                      {[...w].map((ch, ci) => (
                        <span key={ci} className="swap-char" style={{ "--i": wi * 6 + ci } as CSSProperties}>
                          {ch}
                        </span>
                      ))}
                    </span>
                    {wi < all.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </span>
            ))}
          </span>
          <span className="orbit-title-2">Trade with certainty.</span>
        </h1>
        <p className="swap-sub-stack">
          {MESSAGES.map((m, i) => (
            <span key={m.word} aria-hidden={i !== msg} className={`swap-sub ${i === msg ? "is-active" : ""}`}>
              {m.sub}
            </span>
          ))}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Magnetic>
            <Link href="/trust#grading" className="btn btn-ghost-white btn-lg">
              How grading works
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href={current.cta.href} className="btn btn-white btn-lg min-w-[164px]">
              {current.cta.label} <Icon name="arrowRight" size={18} />
            </Link>
          </Magnetic>
        </div>
      </div>

      {/* Reduced motion: a calm, static grid of the same products. */}
      <ul className="orbit-grid" aria-label="Featured products">
        {items.slice(0, 8).map((p) => (
          <li key={p.id}>
            <Link href={`/product/${p.id}`} className="block overflow-hidden rounded-2xl bg-white">
              <ProductImage item={p} width={330} className="aspect-square w-full" artClassName="h-4/5 w-4/5" />
            </Link>
            <p className="mt-2 truncate text-[12px] font-bold text-white/80">{p.name}</p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Play hero animation" : "Pause hero animation"}
        className="orbit-pause"
      >
        <Icon name={paused ? "play" : "pause"} size={18} />
      </button>
      <p aria-hidden className="orbit-hint">
        Drag to spin
      </p>
    </section>
  );
}
