import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/components/home/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME}: Buy, Sell & Swap in Nigeria`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    categories: ["shopping", "lifestyle"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    shortcuts: [
      { name: "Shop phones", url: "/shop/phones" },
      { name: "Sell a device", url: "/sell" },
      { name: "Track an order", url: "/track" },
    ],
  };
}
