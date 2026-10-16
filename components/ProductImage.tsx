"use client";

import { useEffect, useRef, useState } from "react";
import { productImageSrc } from "@/lib/photos";
import type { Product } from "@/lib/types";
import { DeviceArt } from "./DeviceArt";

/**
 * Product photo (uploaded URL or Wikimedia Commons). Falls back to the vector illustration
 * if the photo is missing or fails to load, so a card is never blank.
 */
export function ProductImage({
  item,
  width = 640,
  className = "",
  artClassName = "h-3/4 w-3/4",
  priority = false,
}: {
  item: Pick<Product, "photo" | "imageUrl" | "art" | "tint" | "name">;
  width?: number;
  className?: string;
  artClassName?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Load/error events can fire before hydration; read the image state once mounted.
  useEffect(() => {
    const img = ref.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth === 0) setFailed(true);
    else setLoaded(true);
  }, []);

  const src = productImageSrc(item, width);
  const art = (
    <div className="absolute inset-0 grid place-items-center">
      <DeviceArt kind={item.art} tint={item.tint} className={artClassName} />
    </div>
  );

  if (!src || failed) {
    return (
      <div className={`relative ${className}`} role="img" aria-label={item.name}>
        {art}
      </div>
    );
  }

  // The illustration sits underneath until the photo arrives, so a slow or stalled
  // network never leaves an empty box; the photo fades in over it.
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && art}
      {/* Remote thumbnails are already sized by `width`, so a plain img avoids spending
          the image-optimisation quota on 100+ external files. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={item.name}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
