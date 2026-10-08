"use client";

import { useRef } from "react";
import { ProductImage } from "@/components/ProductImage";
import type { Product } from "@/lib/types";

/**
 * The hero product on the offer landing page: it spins in out of a blur, settles into a
 * slow float on a pulsing glow with a rotating light ring, and tilts in 3D towards the
 * pointer. Reduced-motion users get a still image.
 */
export function OfferHeroStage({
  product,
  badge,
}: {
  product: Pick<Product, "photo" | "imageUrl" | "art" | "tint" | "name">;
  badge: { main: string; sub: string };
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 18}deg) rotateX(${-y * 14}deg) scale(1.03)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" onPointerMove={onMove} onPointerLeave={onLeave}>
      {/* Glow, light ring and ripples behind the product. */}
      <div aria-hidden className="jdo-glow absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(26,92,255,.85)_0%,rgba(26,92,255,.25)_45%,transparent_70%)] blur-2xl" />
      <div
        aria-hidden
        className="jdo-spin absolute inset-[4%] rounded-full opacity-70 [mask:radial-gradient(circle,transparent_64%,#000_65%,#000_67%,transparent_68%)]"
        style={{ background: "conic-gradient(from 0deg, transparent 0 20%, #fff 30%, transparent 40% 70%, #7aa2ff 80%, transparent 90%)" }}
      />
      <div aria-hidden className="jdo-ring absolute inset-[18%] rounded-full border border-white/30" />
      <div aria-hidden className="jdo-ring absolute inset-[18%] rounded-full border border-white/20 [animation-delay:1.6s]" />
      {[
        "left-[12%] top-[18%]",
        "right-[14%] top-[10%] [animation-delay:.8s]",
        "right-[8%] bottom-[24%] [animation-delay:1.5s]",
        "left-[18%] bottom-[12%] [animation-delay:2s]",
      ].map((pos) => (
        <span key={pos} aria-hidden className={`jdo-sparkle absolute h-2.5 w-2.5 rotate-45 bg-white ${pos}`} />
      ))}

      <div className="jdo-hero-in absolute inset-[12%]">
        <div className="jdo-float h-full w-full">
          <div ref={ref} className="jdo-tilt h-full w-full overflow-hidden rounded-[28px] bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,.6),0_0_0_1px_rgba(255,255,255,.1)]">
            <ProductImage item={product} width={960} priority className="h-full w-full" artClassName="h-4/5 w-4/5" />
          </div>
        </div>
      </div>

      <div className="jdo-pop absolute right-[4%] top-[6%] flex h-24 w-24 flex-col items-center justify-center rounded-full bg-sale p-2 text-center text-white shadow-[0_14px_30px_rgba(229,0,75,.45)] sm:h-28 sm:w-28">
        <span className="display text-[24px] font-extrabold leading-none sm:text-[30px]">{badge.main}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px]">{badge.sub}</span>
      </div>
    </div>
  );
}
