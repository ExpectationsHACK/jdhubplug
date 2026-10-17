import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/components/home/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or per-customer pages: admin, APIs, checkout and order pages.
      disallow: ["/admin", "/api", "/checkout", "/order", "/track", "/o/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
