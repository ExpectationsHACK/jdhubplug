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

/** Average (1 decimal) and count of published, verified-purchase reviews. */
export type RatingSummary = { count: number; average: number };

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
  /**
   * @deprecated Legacy seeded values, not real. The storefront ignores them (lib/data.ts
   * zeroes them) and shows `ratingSummary` instead. Kept so stored products still parse.
   */
  rating: number;
  /** @deprecated See `rating`. */
  reviews: number;
  /**
   * Real published-review aggregate for this product's model. Attached by the
   * storefront reads in lib/data.ts; never stored with the product.
   */
  ratingSummary?: RatingSummary;
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
  /** Fallback illustration, copied from the product so old orders render after it's deleted. */
  art?: ArtKind;
  tint?: string;
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
  /** Signed-in customer who placed the order. */
  customerId?: string;
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

/** `orders` counts uses held by open orders (unpaid ones release theirs if they expire); `paid` counts paid ones. */
export type OfferStats = { views: number; orders: number; revenue: number; paid: number };

export type OfferState = "scheduled" | "live" | "expired" | "paused" | "exhausted";

// ----------------------------------------------------------------- Customers

/** A shopper account. Passwordless: customers sign in with a one-time code. */
export type Customer = {
  id: string;
  /** Verified E.164 phone (signed in with an SMS code), e.g. +2348031234567. */
  phone?: string;
  /** Verified email (signed in with an email code). */
  email?: string;
  /** Unverified contact details typed at checkout; only used to prefill the next checkout. */
  contactPhone?: string;
  contactEmail?: string;
  name?: string;
  /** Default delivery details, saved from the last order. */
  address?: string;
  city?: string;
  state?: string;
  createdAt: string;
  lastLoginAt?: string;
  /** Set when an admin blocks the account; blocked customers can't sign in or check out. */
  blocked?: boolean;
};

export type OtpChannel = "sms" | "email";

// ------------------------------------------------------------- Leads, staff

export type LeadType = "sell" | "swap" | "contact" | "vendor";

/**
 * Lead status. Contact and vendor requests only use new / contacted / closed (the
 * original three, so leads stored before the trade-in pipeline still parse). Sell and
 * swap requests move through the whole trade-in pipeline (lib/tradein-flow.ts).
 */
export type LeadStatus =
  | "new"
  | "contacted"
  | "inspection_booked"
  | "inspected"
  | "offer_sent"
  | "accepted" // by the customer
  | "declined" // by the customer
  | "paid"
  | "closed"
  | "cancelled";

/** One step on a lead's timeline. `from === to` for notes and message attempts. */
export type LeadEvent = {
  at: string;
  by: string;
  from: LeadStatus;
  to: LeadStatus;
  note?: string;
  kind?: "status" | "note" | "message";
};

export type InspectionMethod = "pickup" | "dropoff";

export type InspectionBooking = {
  /** Slot start (ISO). */
  at: string;
  method: InspectionMethod;
  /** Pickup address (method "pickup"). */
  address?: string;
  /** Hub city from settings.hubs (method "dropoff"). */
  hub?: string;
  /** Staff member doing the inspection. */
  staff?: string;
  bookedAt: string;
  bookedBy: string;
};

export type ConditionCheck = "ok" | "minor" | "damaged";

export type InspectionChecklist = {
  imeiClean: boolean;
  /** Signed out of iCloud / Google (activation lock off). */
  accountSignedOut: boolean;
  screen: ConditionCheck;
  /** Battery health in percent, when the device reports it. */
  batteryHealth?: number;
  body: ConditionCheck;
  /** Buttons, cameras, speakers, Face ID / fingerprint, charging. */
  functions: "ok" | "issues";
};

export type InspectionResult = {
  grade: Grade;
  checklist: InspectionChecklist;
  finalOffer: number;
  notes?: string;
  inspectedAt: string;
  inspectedBy: string;
};

export type PayoutMethod = "bank" | "cash" | "swap_credit";

/** Bank details as stored on the lead: the account number is masked. The full number
 * lives in a separate admin-only key (see lib/tradein.ts). */
export type PayoutBank = { bankName: string; accountName: string; accountMasked: string };

export type TradeInPayout = {
  method: PayoutMethod;
  amount: number;
  bank?: PayoutBank;
  /** Transfer reference, receipt number, or the swap credit code / order id. */
  reference?: string;
  paidAt: string;
  paidBy: string;
};

export type SwapCredit = {
  /** Offer code (single use, fixed amount). */
  code: string;
  amount: number;
  expiresAt: string;
  issuedAt: string;
  /** Set once an order used the code. */
  redeemedAt?: string;
  orderId?: string;
};

/** Trade-in pipeline data for sell / swap leads. Every field is optional so old leads parse. */
export type TradeIn = {
  /** Instant estimate from the sell / swap tool. */
  estimate?: number;
  /** The instant estimate is honoured until this time (7 days from the request). */
  estimateLockedUntil?: string;
  booking?: InspectionBooking;
  inspection?: InspectionResult;
  offerSentAt?: string;
  response?: { decision: "accepted" | "declined"; at: string; by: string; reason?: string };
  /** How the customer wants to be paid (chosen on accept). */
  payoutChoice?: { method: PayoutMethod; bank?: PayoutBank };
  payout?: TradeInPayout;
  credit?: SwapCredit;
  /** Why the lead was closed or cancelled. */
  closeReason?: string;
};

export type Lead = {
  id: string;
  type: LeadType;
  name: string;
  phone: string;
  email?: string;
  message: string;
  /** Structured details, e.g. model/storage/grade/estimate for sell requests. */
  details?: Record<string, string>;
  status: LeadStatus;
  /** Secret for the customer status page (/trade-in/{id}?t=…). Old leads get one lazily. */
  token?: string;
  trade?: TradeIn;
  history?: LeadEvent[];
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
  /** Require shoppers to sign in (one-time code) before checkout. */
  requireAccountForCheckout: boolean;
};

export type StorageKind = "supabase" | "redis" | "file" | "memory";

export type StorageStatus = {
  kind: StorageKind;
  persistent: boolean;
  label: string;
  hint?: string;
};
