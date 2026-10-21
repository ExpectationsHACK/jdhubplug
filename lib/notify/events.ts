// Order notification events, their default channel toggles and the message-log shape.
// Isomorphic (no store access), so the admin's client components can use them.

import type { DeliveryMethod, OrderStatus } from "../types";

export const NOTIFY_EVENTS = ["placed", "paid", "processing", "shipped", "ready", "delivered", "cancelled", "refunded"] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

/** Everything that can appear in the message log (customer events, the store alert, test emails). */
export type LogEvent = NotifyEvent | "store-alert" | "test";

export const EVENT_LABEL: Record<LogEvent, string> = {
  placed: "Order placed",
  paid: "Payment received",
  processing: "Processing",
  shipped: "Shipped / out for delivery",
  ready: "Ready for pickup",
  delivered: "Delivered / collected",
  cancelled: "Cancelled",
  refunded: "Refunded",
  "store-alert": "New-order alert (store)",
  test: "Test email",
};

export const EVENT_HINT: Record<NotifyEvent, string> = {
  placed: "Confirmation with items, totals, how to pay and the reservation deadline.",
  paid: "Sent when a payment is confirmed (Paystack or marked paid).",
  processing: "The order is being packed and inspected.",
  shipped: "Delivery orders handed to the rider or courier.",
  ready: "Pickup orders waiting at the hub, with the hub address.",
  delivered: "Delivered to the buyer, or collected at the hub.",
  cancelled: "Includes the reason, e.g. the payment window expired.",
  refunded: "Confirms the refunded amount.",
};

export type ChannelToggles = { email: boolean; sms: boolean };

export type NotifySettings = {
  events: Record<NotifyEvent, ChannelToggles>;
  /** New-order alert to the store's own email (settings.email) and phone (settings.phone). */
  storeAlert: ChannelToggles;
};

const SMS_DEFAULT: NotifyEvent[] = ["shipped", "ready", "cancelled"];

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  events: Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, { email: true, sms: SMS_DEFAULT.includes(e) }])) as Record<NotifyEvent, ChannelToggles>,
  storeAlert: { email: true, sms: false },
};

/** Merge stored settings over the defaults so new events always have a value. */
export function notifyWithDefaults(s: Partial<NotifySettings> | null | undefined): NotifySettings {
  const events = { ...DEFAULT_NOTIFY_SETTINGS.events };
  for (const e of NOTIFY_EVENTS) {
    const v = s?.events?.[e];
    if (v) events[e] = { email: !!v.email, sms: !!v.sms };
  }
  const a = s?.storeAlert;
  return { events, storeAlert: a ? { email: !!a.email, sms: !!a.sms } : { ...DEFAULT_NOTIFY_SETTINGS.storeAlert } };
}

/**
 * The customer message for an order reaching `status`, or null when that status sends
 * nothing. "shipped" means "ready at the hub" for pickup orders.
 */
export function eventForStatus(status: OrderStatus, delivery: DeliveryMethod): NotifyEvent | null {
  switch (status) {
    case "pending":
      return "placed";
    case "shipped":
      return delivery === "pickup" ? "ready" : "shipped";
    case "completed":
      return null; // the buyer confirmed it themselves; nothing new to tell them
    default:
      return status;
  }
}

export type Channel = "email" | "sms";
export type DeliveryStatus = "ok" | "skipped" | "error";

export type NotifyLogEntry = {
  at: string;
  event: LogEvent;
  orderId?: string;
  channel: Channel;
  /** Masked recipient, e.g. ad•••@gmail.com or +234803 ••• 4567. */
  to: string;
  status: DeliveryStatus;
  /** Who received it. */
  audience: "customer" | "store" | "test";
  /** Error or skip reason, or the provider's message id. */
  detail?: string;
  /** Set when an admin resent it by hand. */
  by?: string;
};

export function maskEmail(email: string) {
  const [user = "", domain = ""] = email.trim().toLowerCase().split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`;
}

export function maskPhone(phone: string) {
  const p = phone.replace(/[^\d+]/g, "");
  if (p.length < 8) return "•••";
  return `${p.slice(0, Math.min(7, p.length - 4))} ••• ${p.slice(-4)}`;
}
