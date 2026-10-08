// Types shared by the product admin's client components and its Server Actions.

import type { Badge, Product, ProductStatus } from "@/lib/types";
import type { FieldErrors } from "./validate";

export type BulkOp =
  | { type: "status"; status: ProductStatus }
  | { type: "featured"; featured: boolean }
  | { type: "badge"; badge: Badge | null }
  /** Change prices by a percentage, rounded to the nearest ₦500. */
  | { type: "price"; percent: number }
  | { type: "stock"; units: number }
  | { type: "delete" };

/** Result of the product form's Server Action (useActionState). */
export type SaveState = {
  /** Increments on every response so effects can react to repeated results. */
  nonce: number;
  ok?: boolean;
  message?: string;
  error?: string;
  errors?: FieldErrors;
  /** Id of the saved product (a new id after create or "save as new"). */
  id?: string;
  created?: boolean;
};

/** The subset of a product the list and inventory screens need. */
export type ProductRow = Pick<
  Product,
  | "id"
  | "name"
  | "brand"
  | "spec"
  | "model"
  | "seller"
  | "category"
  | "grade"
  | "price"
  | "was"
  | "stock"
  | "sold"
  | "status"
  | "featured"
  | "badge"
  | "photo"
  | "imageUrl"
  | "art"
  | "tint"
  | "createdAt"
  | "updatedAt"
>;

export const toRow = (p: Product): ProductRow => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  spec: p.spec,
  model: p.model,
  seller: p.seller,
  category: p.category,
  grade: p.grade,
  price: p.price,
  was: p.was,
  stock: p.stock,
  sold: p.sold,
  status: p.status,
  featured: p.featured,
  badge: p.badge,
  photo: p.photo,
  imageUrl: p.imageUrl,
  art: p.art,
  tint: p.tint,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});
