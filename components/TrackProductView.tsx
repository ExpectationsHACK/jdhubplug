"use client";

import { useEffect } from "react";
import { productProps, track } from "@/lib/analytics";
import type { Product } from "@/lib/types";

/** Records a product_viewed analytics event once per product page view. */
export function TrackProductView({ product }: { product: Pick<Product, "id" | "name" | "brand" | "category" | "price" | "grade" | "stock"> }) {
  useEffect(() => {
    track("product_viewed", { ...productProps(product), in_stock: product.stock > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  return null;
}
