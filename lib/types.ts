// Shared domain types for the storefront, the admin and the store layer.
// Isomorphic: safe to import from client and server code.

export type CategorySlug = "phones" | "accessories" | "gadgets" | "cars";

export type Grade = "like-new" | "great" | "good" | "fair";

export type ArtKind =
  | "phone"
  | "earbuds"
  | "charger"
  | "case"
  | "powerbank"
  | "laptop"
  | "tablet"
  | "watch"
  | "drone"
  | "console"
  | "camera"
  | "car";

export type Badge = "New" | "Best seller" | "Hot deal" | "Swap pick";

export type ProductStatus = "active" | "draft" | "archived";

export type Product = {
  id: string;
  /** Model slug this product was seeded from (groups units of the same model). */
  model: string;
  category: CategorySlug;
  brand: string;
  name: string;
  /** Short spec line shown under the name on cards. */
  spec: string;
  /** Selling price in naira. */
  price: number;
  /** Strike-through price, when the item is discounted. */
  was?: number;
  grade: Grade;
  /** Location (Nigerian state) the item ships from. */
  state: string;
  seller: string;
  verified: boolean;
  rating: number;
  reviews: number;
  /** Fallback illustration kind and tint, used when no photo loads. */
  art: ArtKind;
  tint: string;
  /** Wikimedia Commons file name. */
  photo?: string;
  /** Any absolute image URL (uploaded or pasted). Takes precedence over `photo`. */
  imageUrl?: string;
  badge?: Badge;
  attrs: Record<string, string>;
  /** Units available. 0 means sold out. Kept in sync with the store's atomic stock counter. */
  stock: number;
  /** Units sold through JDHub checkout. */
  sold: number;
  status: ProductStatus;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated Use Product. Kept so older components keep compiling during the migration. */
export type Listing = Product;

export type Category = {
  slug: CategorySlug;
  name: string;
  tagline: string;
  blurb: string;
  art: ArtKind;
  brands: string[];
};

// ------------------------------------------------------------------ Orders

export type OrderStatus =
  | "pending" // placed, stock reserved, awaiting payment
  | "paid" // payment confirmed, funds in escrow
  | "processing" // being packed / inspected
  | "shipped" // handed to logistics or ready at hub
  | "delivered" // buyer received, inspection window running
  | "completed" // buyer confirmed, escrow released
  | "cancelled" // cancelled before payment or by admin, stock restored
  | "refunded"; // refunded after payment, stock restored

export type PaymentMethod = "paystack" | "transfer" | "whatsapp";

export type DeliveryMethod = "delivery" | "pickup";

export type OrderLine = {
  productId: string;
  name: string;
  spec: string;
  photo?: string;
  imageUrl?: string;
  qty: number;
  /** Unit price before any offer. */
  unitPrice: number;
  /** Unit price actually charged (after offer). */
  finalUnitPrice: number;
};

export type OrderEvent = {
  at: string;
  status: OrderStatus | "note";
  by: string;
  note?: string;
};

export type Order = {
  id: string; // e.g. JDH-10234
  /** Secret used in customer-facing links so order pages can't be enumerated. */
  token: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  offerCode?: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    state: string;
  };
  delivery: DeliveryMethod;
  pickupHub?: string;
  payment: {
    method: PaymentMethod;
    reference?: string;
    paidAt?: string;
  };
  customerNote?: string;
  /** Pending orders auto-cancel (and restock) after this time if unpaid. */
  reservedUntil?: string;
  /** True once stock for this order has been returned, so it is never restocked twice. */
  restocked?: boolean;
  history: OrderEvent[];
};

// ------------------------------------------------------------------ Offers

export type OfferDiscount =
  | { type: "percent"; value: number } // e.g. 10 = 10% off
  | { type: "fixed"; value: number } // naira off each unit
  | { type: "price"; value: number }; // flash price per unit (only sensible with product scope)

export type OfferScope =
  | { type: "all" }
  | { type: "categories"; categories: CategorySlug[] }
  | { type: "brands"; brands: string[] }
  | { type: "products"; productIds: string[] };

export type Offer = {
  /** URL-safe code used in the special link: /o/{code}. */
  code: string;
  title: string;
  headline: string;
  description: string;
  discount: OfferDiscount;
  scope: OfferScope;
  startsAt: string;
  endsAt: string;
  active: boolean;
  /** Max number of orders that can use this offer. Undefined = unlimited. */
  usageLimit?: number;
  /** Minimum cart subtotal (before discount) for the offer to apply. */
  minSubtotal?: number;
  /** Product id whose photo is used as the offer banner. */
  heroProductId?: string;
  createdAt: string;
  updatedAt: string;
};

export type OfferStats = { views: number; orders: number; revenue: number };

export type OfferState = "scheduled" | "live" | "expired" | "paused" | "exhausted";

// ------------------------------------------------------------- Leads, staff

export type LeadType = "sell" | "swap" | "contact" | "vendor";

export type Lead = {
  id: string;
  type: LeadType;
  name: string;
  phone: string;
  email?: string;
  message: string;
  /** Structured details, e.g. model/storage/grade/estimate for sell requests. */
  details?: Record<string, string>;
  status: "new" | "contacted" | "closed";
  createdAt: string;
  updatedAt: string;
};

export type Role = "owner" | "manager" | "support";

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "owner"> | "owner";
  passwordHash: string;
  salt: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

export type AuditEntry = {
  at: string;
  by: string;
  action: string;
  target?: string;
  detail?: string;
};

// ---------------------------------------------------------------- Settings

export type Hub = { city: string; address: string; hours: string };

export type Settings = {
  storeName: string;
  whatsapp: string; // international format without +, e.g. 2348012345678
  phone: string;
  email: string;
  promoText: string;
  promoLink: string;
  promoEnabled: boolean;
  lowStockThreshold: number;
  /** Minutes a pending (unpaid) order holds its stock before auto-cancelling. */
  reservationMinutes: number;
  deliveryFeeLagos: number;
  deliveryFeeOther: number;
  freeDeliveryOver: number;
  hubs: Hub[];
  bank: { bankName: string; accountName: string; accountNumber: string };
  hideSoldOut: boolean;
  /** Product ids featured in the home hero showcase (falls back to auto-pick). */
  heroProductIds: string[];
};

export type StorageKind = "redis" | "file" | "memory";

export type StorageStatus = {
  kind: StorageKind;
  persistent: boolean;
  label: string;
  hint?: string;
};
