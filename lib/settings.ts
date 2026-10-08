// Default store settings. Isomorphic. The live values are edited in /admin/settings
// and read with getStoreSettings() (lib/data.ts).

import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  storeName: "JDHub",
  whatsapp: "2348000000000",
  phone: "+234 800 000 0000",
  email: "hello@jdhub.ng",
  promoText: "Every order escrow-protected. Get paid within 48 hours when you sell.",
  promoLink: "/trust",
  promoEnabled: true,
  lowStockThreshold: 2,
  reservationMinutes: 24 * 60,
  deliveryFeeLagos: 3_500,
  deliveryFeeOther: 7_500,
  freeDeliveryOver: 500_000,
  hubs: [
    { city: "Lagos", address: "Computer Village, Ikeja", hours: "Mon–Sat, 9am–7pm" },
    { city: "Abuja", address: "Banex Plaza, Wuse 2", hours: "Mon–Sat, 9am–6pm" },
    { city: "Port Harcourt", address: "GRA Phase 2", hours: "Mon–Sat, 9am–6pm" },
  ],
  bank: { bankName: "", accountName: "", accountNumber: "" },
  hideSoldOut: false,
  heroProductIds: [],
};

/** Merge stored settings over the defaults so new fields always have a value. */
export function withDefaults(s: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(s ?? {}),
    bank: { ...DEFAULT_SETTINGS.bank, ...(s?.bank ?? {}) },
    hubs: s?.hubs?.length ? s.hubs : DEFAULT_SETTINGS.hubs,
    heroProductIds: s?.heroProductIds ?? [],
  };
}

export const waLink = (number: string, text: string) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
