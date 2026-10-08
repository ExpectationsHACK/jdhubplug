// Product image URLs. Isomorphic.
//
// Commons serves thumbnails at any width, but it caches and serves the standard
// buckets fastest (and rate-limits unusual sizes for hotlinkers), so requested
// widths are rounded up to the nearest standard bucket.

const COMMONS_BUCKETS = [120, 250, 330, 500, 960, 1280, 1920];

export function commonsWidth(width: number) {
  return COMMONS_BUCKETS.find((b) => b >= width) ?? COMMONS_BUCKETS[COMMONS_BUCKETS.length - 1];
}

/** Thumbnail served by Wikimedia Commons, at the nearest standard width. */
export const photoUrl = (file: string, width = 960) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${commonsWidth(width)}`;

/** Commons file page, which carries the author and licence. */
export const photoPage = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;

/** Best image URL for a product: an uploaded/pasted URL wins over the Commons photo. */
export function productImageSrc(p: { imageUrl?: string; photo?: string }, width = 960): string | undefined {
  if (p.imageUrl) return p.imageUrl;
  if (p.photo) return photoUrl(p.photo, width);
  return undefined;
}
