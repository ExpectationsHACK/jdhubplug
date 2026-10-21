// Site-wide constants for metadata, sitemap and structured data. Isomorphic.

/**
 * The deployment's public origin when one is known: NEXT_PUBLIC_SITE_URL (your domain),
 * else the Vercel production domain (exposed automatically on Vercel), else undefined.
 */
export function configuredOrigin(): string | undefined {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (vercel ? `https://${vercel}` : "");
  return url ? url.replace(/\/+$/, "") : undefined;
}

/**
 * Canonical origin, without a trailing slash. Set NEXT_PUBLIC_SITE_URL to your domain in
 * production; until then canonical links and the sitemap use the Vercel domain, never a
 * domain the store may not own.
 */
export const SITE_URL = configuredOrigin() ?? "http://localhost:3000";

export const SITE_NAME = "JDHub";

export const SITE_DESCRIPTION =
  "Nigeria's graded trade platform. Buy, sell and swap phones, accessories, gadgets and cars with transparent grading, verified sellers and escrow-protected payment.";

/** Absolute URL for a path on this site. */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
