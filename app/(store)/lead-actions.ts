"use server";

import { createLead } from "@/lib/store";
import type { LeadType } from "@/lib/types";

export type LeadState = { ok?: boolean; error?: string };

const TYPES: LeadType[] = ["sell", "swap", "contact", "vendor"];

/** Save a sell/swap/contact/vendor request so it shows up in /admin/requests. */
export async function submitLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  const type = String(form.get("type") ?? "contact") as LeadType;
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const phone = String(form.get("phone") ?? "").trim().slice(0, 30);
  const email = String(form.get("email") ?? "").trim().slice(0, 120) || undefined;
  const message = String(form.get("message") ?? "").trim().slice(0, 2000);
  if (String(form.get("company") ?? "")) return { ok: true }; // honeypot: bots fill hidden fields
  if (!TYPES.includes(type)) return { error: "Unknown request type." };
  if (name.length < 2) return { error: "Please enter your name." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Please enter a valid phone number." };

  const details: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("d_") && typeof v === "string" && v) details[k.slice(2)] = v.slice(0, 200);
  }
  await createLead({ type, name, phone, email, message, details: Object.keys(details).length ? details : undefined });
  return { ok: true };
}
