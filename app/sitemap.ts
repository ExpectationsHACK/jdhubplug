import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/components/home/site";
import { categories } from "@/lib/reference";
import { getCatalog } from "@/lib/data";

// Public pages plus every active product. Cached with the catalog tag, so new and
// removed products show up after the next catalog refresh.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getCatalog();
  const latest = products.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), "");
  const lastModified = latest ? new Date(latest) : undefined;

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), lastModified, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({
      url: absoluteUrl(`/shop/${c.slug}`),
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/sell"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/swap"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/trust"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/vendors"), changeFrequency: "monthly", priority: 0.5 },
  ];

  return [
    ...pages,
    ...products.map((p) => ({
      url: absoluteUrl(`/product/${p.id}`),
      lastModified: new Date(p.updatedAt),
      changeFrequency: "weekly" as const,
      priority: p.stock > 0 ? 0.6 : 0.3,
    })),
  ];
}
