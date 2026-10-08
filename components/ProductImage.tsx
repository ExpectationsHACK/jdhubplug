"use client";

import { useEffect, useRef, useState } from "react";
import { photoUrl, type Listing } from "@/lib/catalog";
import { DeviceArt } from "./DeviceArt";

/**
 * Product photo from Wikimedia Commons. Falls back to the vector illustration
 * if the photo is missing or fails to load, so a card is never blank.
 */
export function ProductImage({
  item,
  width = 640,
  className = "",
  artClassName = "h-3/4 w-3/4",
  priority = false,
}: {
  item: Pick<Listing, "photo" | "art" | "tint" | "name">;
  width?: number;
  className?: string;
  artClassName?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // An image that failed before hydration never fires onError, so check once mounted.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!item.photo || failed) {
    return (
      <div className={`grid place-items-center ${className}`}>
        <DeviceArt kind={item.art} tint={item.tint} className={artClassName} />
      </div>
    );
  }

  return (
    // Remote Commons thumbnails are already sized by `width`, so a plain img avoids
    // spending the image-optimisation quota on 100+ external files.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={photoUrl(item.photo, width)}
      alt={item.name}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
