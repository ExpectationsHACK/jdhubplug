"use server";

import { createLead } from "@/lib/store";
import { initialTradeFields } from "@/lib/tradein";
import { isTradeIn, statusPath } from "@/lib/tradein-flow";
import type { LeadType } from "@/lib/types";

export type LeadState = {
  ok?: boolean;
  error?: string;
  /** Sell / swap requests: the customer's private status page (/trade-in/{id}?t=…). */
  statusUrl?: string;
  /** Echo of what was typed, so a failed submit doesn't wipe the form. */
  values?: { name?: string; phone?: string; email?: string; message?: string };
  /** Changes on every failed submit so the error can re-animate. */
  n?: number;
};

const TYPES: LeadType[] = ["sell", "swap", "contact", "vendor"];
const MAX_DETAILS = 12;

/** Save a sell/swap/contact/vendor request so it shows up in /admin/requests. */
export async function submitLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  const type = String(form.get("type") ?? "contact") as LeadType;
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const phone = String(form.get("phone") ?? "").trim().slice(0, 30);
  const email = String(form.get("email") ?? "").trim().slice(0, 120) || undefined;
  const message = String(form.get("message") ?? "").trim().slice(0, 2000);
  const values = { name, phone, email, message };
  const fail = (error: string): LeadState => ({ error, values, n: Date.now() });

  if (String(form.get("company") ?? "")) return { ok: true }; // honeypot: bots fill hidden fields
  if (!TYPES.includes(type)) return fail("Unknown request type.");
  if (name.length < 2) return fail("Please enter your name.");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return fail("Please enter a valid phone number.");
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return fail("Please enter a valid email address.");

  const details: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (Object.keys(details).length >= MAX_DETAILS) break;
    const key = k.slice(2);
    if (k.startsWith("d_") && /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(key) && typeof v === "string" && v.trim()) {
      details[key] = v.trim().slice(0, 200);
    }
  }
  const input = { type, name, phone, email, message, details: Object.keys(details).length ? details : undefined };
  const lead = await createLead(isTradeIn(input) ? { ...input, ...initialTradeFields(input) } : input);
  return { ok: true, ...(isTradeIn(lead) && lead.token ? { statusUrl: statusPath(lead) } : {}) };
}
