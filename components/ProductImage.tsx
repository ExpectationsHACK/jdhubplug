"use client";

import { useEffect, useRef, useState } from "react";
import { productImageSources } from "@/lib/photos";
import type { Product } from "@/lib/types";
import { DeviceArt } from "./DeviceArt";

/**
 * Product photo (uploaded URL or Wikimedia Commons). Tries the direct Commons thumbnail
 * first, then the redirecting URL, showing a soft shimmer while it loads (never a drawn
 * mock-up). If every source fails:
 * - placeholder "art": the vector illustration, so a product card is never blank;
 * - placeholder "shimmer": a plain tile (animations and showcases show real photos only).
 */
export function ProductImage({
  item,
  width = 640,
  className = "",
  artClassName = "h-3/4 w-3/4",
  priority = false,
  placeholder = "art",
}: {
  item: Pick<Product, "photo" | "imageUrl" | "art" | "tint" | "name">;
  width?: number;
  className?: string;
  artClassName?: string;
  priority?: boolean;
  placeholder?: "art" | "shimmer";
}) {
  const sources = productImageSources(item, width);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const src = sources[attempt];

  // Load/error events can fire before hydration; read the image state once mounted.
  useEffect(() => {
    const img = ref.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth === 0) setAttempt((a) => a + 1);
    else setLoaded(true);
  }, [src]);

  if (!src) {
    return (
      <div className={`relative ${className}`} role="img" aria-label={item.name}>
        {placeholder === "art" ? (
          <div className="absolute inset-0 grid place-items-center">
            <DeviceArt kind={item.art} tint={item.tint} className={artClassName} />
          </div>
        ) : (
          <div aria-hidden className="absolute inset-0 bg-stage" />
        )}
      </div>
    );
  }

  // The placeholder sits underneath until the photo arrives, so a slow or stalled
  // network never leaves an empty box; the photo fades in over it.
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <div aria-hidden className="absolute inset-0">
          <div className="skeleton h-full w-full" />
        </div>
      )}
      {/* Remote thumbnails are already sized by `width`, so a plain img avoids spending
          the image-optimisation quota on 100+ external files. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        ref={ref}
        src={src}
        alt={item.name}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setAttempt((a) => a + 1)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
