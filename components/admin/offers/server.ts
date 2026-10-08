import "server-only";

import { headers } from "next/headers";
import QRCode from "qrcode";
import { categories } from "@/lib/catalog";
import { listProducts } from "@/lib/store";
import type { PickerProduct } from "./ProductPicker";

// Server helpers for the admin offer screens.

/** Public origin for special links: NEXT_PUBLIC_SITE_URL, else the request host. */
export async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (/^(localhost|127\.|\[::1\])/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export const specialLink = (origin: string, code: string) => `${origin}/o/${encodeURIComponent(code)}`;

/** Products (slimmed for the client) and brand names for the offer form pickers. */
export async function offerFormData(): Promise<{ products: PickerProduct[]; brands: string[] }> {
  const all = await listProducts();
  const products: PickerProduct[] = all
    .filter((p) => p.status !== "archived")
    .map((p) => ({
      id: p.id,
      name: p.name,
      spec: p.spec,
      brand: p.brand,
      category: p.category,
      price: p.price,
      stock: p.stock,
      status: p.status,
      photo: p.photo,
      imageUrl: p.imageUrl,
      art: p.art,
      tint: p.tint,
    }));
  const brandSet = new Map<string, string>();
  for (const b of [...categories.flatMap((c) => c.brands), ...all.map((p) => p.brand)]) {
    const t = b.trim();
    if (t && !brandSet.has(t.toLowerCase())) brandSet.set(t.toLowerCase(), t);
  }
  return { products, brands: [...brandSet.values()].sort((a, b) => a.localeCompare(b)) };
}

/** QR code for a URL as an SVG string (black on white, small quiet zone). */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
