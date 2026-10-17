"use server";

import { redirect } from "next/navigation";
import { findOrderByPhone } from "@/lib/orders";
import { clientIp } from "@/lib/request-ip";
import { rateLimit } from "@/lib/store";

export type TrackState = { error?: string; id?: string; phone?: string };

/** Find an order by number + phone and open its page. Same message for every miss, so it can't be probed. */
export async function trackOrder(_prev: TrackState, form: FormData): Promise<TrackState> {
  const raw = String(form.get("id") ?? "").trim().toUpperCase().slice(0, 20);
  const phone = String(form.get("phone") ?? "").trim().slice(0, 30);
  // Accept "10234", "JDH10234" or "JDH-10234".
  const digits = raw.replace(/^JDH-?/, "");
  const id = /^\d{4,8}$/.test(digits) ? `JDH-${digits}` : raw;

  if (!/^JDH-\d{4,8}$/.test(id)) return { error: "Enter your order number, e.g. JDH-10234.", id: raw, phone };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter the phone number you used at checkout.", id: raw, phone };

  // Order numbers are sequential, so lookups are limited per visitor and per phone.
  const digitsOnly = phone.replace(/\D/g, "").slice(-10);
  if (!(await rateLimit(`track-ip:${await clientIp()}`, 20, 15 * 60)) || !(await rateLimit(`track-phone:${digitsOnly}`, 10, 15 * 60))) {
    return { error: "Too many lookups. Please wait 15 minutes and try again.", id: raw, phone };
  }

  const order = await findOrderByPhone(id, phone);
  if (!order) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 400));
    return { error: "We couldn't find an order with that number and phone. Check both and try again.", id: raw, phone };
  }
  redirect(`/order/${order.id}?t=${order.token}`);
}
