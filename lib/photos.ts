// Product image URLs. Isomorphic.
//
// Commons serves thumbnails at any width, but it caches and serves the standard
// buckets fastest (and rate-limits unusual sizes for hotlinkers), so requested
// widths are rounded up to the nearest standard bucket.

import { md5 } from "./md5";
import { LOCAL_PHOTOS } from "./photo-manifest";

const COMMONS_BUCKETS = [120, 250, 330, 500, 960, 1280, 1920];

export function commonsWidth(width: number) {
  return COMMONS_BUCKETS.find((b) => b >= width) ?? COMMONS_BUCKETS[COMMONS_BUCKETS.length - 1];
}

/** Thumbnail served by Wikimedia Commons, at the nearest standard width. */
export const photoUrl = (file: string, width = 960) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${commonsWidth(width)}`;

/**
 * Direct thumbnail on upload.wikimedia.org (no redirect hop, so it starts loading
 * sooner). Commons shards files by the MD5 of the name; SVGs are rasterised to PNG.
 * Fails for originals narrower than the requested width; callers then fall back to
 * photoUrl(), which serves the original.
 */
export function commonsThumbUrl(file: string, width = 960) {
  const name = file.replace(/ /g, "_");
  const hash = md5(name);
  const enc = encodeURIComponent(name);
  const ext = /\.svg$/i.test(name) ? ".png" : "";
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${hash[0]}/${hash.slice(0, 2)}/${enc}/${commonsWidth(width)}px-${enc}${ext}`;
}

/** Commons file page, which carries the author and licence. */
export const photoPage = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;

/** File name of a self-hosted copy of a Commons photo (without the size suffix). */
export const localPhotoName = (file: string) =>
  file
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

/** Our own copy of a Commons photo (public/products/), if one has been downloaded. */
export function localPhotoUrl(file: string, width = 960) {
  return LOCAL_PHOTOS.has(file) ? `/products/${localPhotoName(file)}-${width <= 480 ? 480 : 960}.webp` : undefined;
}

/**
 * Image URLs to try in order: an uploaded photo; else our own copy of the Commons
 * photo; then the direct Commons thumbnail; then the redirecting Commons URL.
 */
export function productImageSources(p: { imageUrl?: string; photo?: string }, width = 960): string[] {
  if (p.imageUrl) return [p.imageUrl];
  if (!p.photo) return [];
  const local = localPhotoUrl(p.photo, width);
  return [...(local ? [local] : []), commonsThumbUrl(p.photo, width), photoUrl(p.photo, width)];
}

/** Best image URL for a product: an uploaded/pasted URL wins over the Commons photo. */
export function productImageSrc(p: { imageUrl?: string; photo?: string }, width = 960): string | undefined {
  if (p.imageUrl) return p.imageUrl;
  if (p.photo) return localPhotoUrl(p.photo, width) ?? photoUrl(p.photo, width);
  return undefined;
}
