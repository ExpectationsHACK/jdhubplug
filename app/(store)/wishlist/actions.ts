"use server";

import { getCurrentCustomer } from "@/lib/customer-auth";
import { getProducts } from "@/lib/store";
import type { Product } from "@/lib/types";
import { cleanIds, mergeWishlist, setWishlistItem, WISHLIST_MAX } from "@/lib/wishlist";

// Wishlist Server Actions. The signed-in customer comes from the session cookie only;
// product ids from the browser are validated and checked against the store.

/** Merge the browser's list into the account and return the merged list (null when signed out). */
export async function syncWishlistAction(localIds: string[]): Promise<string[] | null> {
  const customer = await getCurrentCustomer();
  if (!customer) return null;
  return mergeWishlist(customer.id, localIds);
}

/** Save or unsave one product on the account. Returns the account's list (null when signed out). */
export async function toggleWishlistAction(productId: string, saved: boolean): Promise<string[] | null> {
  const customer = await getCurrentCustomer();
  if (!customer) return null;
  return setWishlistItem(customer.id, String(productId ?? ""), saved === true);
}

export type WishlistProduct = Pick<
  Product,
  "id" | "model" | "name" | "brand" | "spec" | "price" | "was" | "grade" | "photo" | "imageUrl" | "art" | "tint" | "category" | "stock" | "state"
>;

/** Live price and stock for saved products. Unknown, draft and archived products are left out. */
export async function wishlistProductsAction(ids: string[]): Promise<WishlistProduct[]> {
  const list = cleanIds(ids, WISHLIST_MAX);
  if (!list.length) return [];
  const found = await getProducts(list);
  return list
    .map((id) => found.get(id))
    .filter((p): p is Product => !!p && p.status === "active")
    .map((p) => ({
      id: p.id,
      model: p.model,
      name: p.name,
      brand: p.brand,
      spec: p.spec,
      price: p.price,
      was: p.was,
      grade: p.grade,
      photo: p.photo,
      imageUrl: p.imageUrl,
      art: p.art,
      tint: p.tint,
      category: p.category,
      stock: p.stock,
      state: p.state,
    }));
}
