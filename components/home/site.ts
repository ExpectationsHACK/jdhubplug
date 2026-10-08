// Site-wide constants for metadata, sitemap and structured data. Isomorphic.

/** Canonical origin, without a trailing slash. Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://jdhub.ng").replace(/\/+$/, "");

export const SITE_NAME = "JDHub";

export const SITE_DESCRIPTION =
  "Nigeria's graded trade platform. Buy, sell and swap phones, accessories, gadgets and cars with transparent grading, verified sellers and escrow-protected payment.";

/** Absolute URL for a path on this site. */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
