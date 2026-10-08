import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { customerSignInAvailable, otpChannels, sendOtp } from "./otp";
import { CUSTOMER_COOKIE, CUSTOMER_TTL_SECONDS, signCustomerSession, verifyCustomerSession } from "./session";
import { deleteOtp, findCustomer, getCustomer, getOtp, getSessionEpoch, getSettings, putOtp, rateLimit, saveCustomer } from "./store";
import type { Customer, OtpChannel } from "./types";

// Passwordless customer accounts.
//
// 1. requestCode(identifier): the shopper enters a phone number or email. We send a
//    6-digit code (SMS via Termii / email via Resend) and store only its hash, with a
//    10-minute expiry and 5 attempts. Requests are rate-limited per identifier and per IP.
// 2. verifyCode(identifier, code): on a match we find or create the Customer and set a
//    signed, httpOnly session cookie for 30 days.
//
// Responses never reveal whether an account exists. Admin sessions use a different
// cookie and signing key, so the two systems can't be confused.

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30_000;

export type Identifier = { channel: OtpChannel; value: string; display: string };

/** Normalise a Nigerian phone number to E.164 (+234…), or return null. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (!/^[789][01]\d{8}$/.test(d)) return null;
  return `+234${d}`;
}

export function parseIdentifier(input: string): Identifier | null {
  const raw = input.trim();
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return null;
    const [user, domain] = email.split("@");
    return { channel: "email", value: email, display: `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}` };
  }
  const phone = normalizePhone(raw);
  if (!phone) return null;
  return { channel: "sms", value: phone, display: `${phone.slice(0, 7)} ••• ${phone.slice(-4)}` };
}

const enc = new TextEncoder();

async function hashCode(identifier: string, code: string) {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "jdhub-dev-secret";
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`jdhub-otp:${secret}:${identifier}:${code}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

export type RequestCodeResult =
  | { ok: true; channel: OtpChannel; display: string; devCode?: string }
  | { ok: false; error: string };

export async function requestCode(input: string): Promise<RequestCodeResult> {
  if (!customerSignInAvailable()) return { ok: false, error: "Sign-in isn't available right now. Please contact us on WhatsApp." };
  const id = parseIdentifier(input);
  if (!id) return { ok: false, error: "Enter a valid Nigerian phone number (e.g. 0803 123 4567) or an email address." };

  const channels = otpChannels();
  if (!channels.dev && ((id.channel === "sms" && !channels.sms) || (id.channel === "email" && !channels.email))) {
    return { ok: false, error: id.channel === "sms" ? "Phone sign-in isn't available yet. Use your email address." : "Email sign-in isn't available yet. Use your phone number." };
  }

  const ip = await clientIp();
  if (!(await rateLimit(`otp-ip:${ip}`, 20, 3600))) return { ok: false, error: "Too many requests. Please wait a while and try again." };

  const existing = await getOtp(id.value);
  if (existing && Date.now() - existing.sentAt < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "We just sent a code. Wait 30 seconds before asking for another." };
  }
  if (!(await rateLimit(`otp-id:${id.value}`, 5, 15 * 60))) return { ok: false, error: "Too many codes requested. Please try again in 15 minutes." };

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  await putOtp(id.value, { hash: await hashCode(id.value, code), exp: Date.now() + CODE_TTL_MS, attempts: 0, sentAt: Date.now() });

  const settings = await getSettings();
  const sent = await sendOtp(id.channel, id.value, code, settings.storeName);
  if (!sent.ok) {
    await deleteOtp(id.value);
    return { ok: false, error: sent.error };
  }
  return { ok: true, channel: id.channel, display: id.display, devCode: sent.devCode };
}

export type VerifyCodeResult = { ok: true; customer: Customer; isNew: boolean } | { ok: false; error: string };

export async function verifyCode(input: string, code: string): Promise<VerifyCodeResult> {
  const id = parseIdentifier(input);
  const clean = code.replace(/\D/g, "");
  if (!id || clean.length !== 6) return { ok: false, error: "Enter the 6-digit code we sent you." };

  const rec = await getOtp(id.value);
  if (!rec || rec.exp < Date.now()) return { ok: false, error: "That code has expired. Request a new one." };
  if (rec.attempts >= MAX_ATTEMPTS) {
    await deleteOtp(id.value);
    return { ok: false, error: "Too many wrong attempts. Request a new code." };
  }
  if (!safeEqual(await hashCode(id.value, clean), rec.hash)) {
    await putOtp(id.value, { ...rec, attempts: rec.attempts + 1 });
    const left = MAX_ATTEMPTS - rec.attempts - 1;
    return { ok: false, error: left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code." };
  }
  await deleteOtp(id.value);

  const now = new Date().toISOString();
  let customer = await findCustomer(id.channel === "sms" ? { phone: id.value } : { email: id.value });
  const isNew = !customer;
  if (customer?.blocked) return { ok: false, error: "This account can't sign in. Please contact us on WhatsApp." };
  customer = await saveCustomer(
    customer
      ? { ...customer, lastLoginAt: now }
      : {
          id: `C-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
          ...(id.channel === "sms" ? { phone: id.value } : { email: id.value }),
          createdAt: now,
          lastLoginAt: now,
        },
  );

  const token = await signCustomerSession({ sub: customer.id, ep: await getSessionEpoch() });
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_TTL_SECONDS,
  });
  return { ok: true, customer, isNew };
}

/** The signed-in customer, or null. Blocked or revoked sessions count as signed out. */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const session = await verifyCustomerSession((await cookies()).get(CUSTOMER_COOKIE)?.value);
  if (!session) return null;
  if ((session.ep ?? 0) < (await getSessionEpoch())) return null;
  const customer = await getCustomer(session.sub);
  return customer && !customer.blocked ? customer : null;
}

/** Require a signed-in customer; otherwise redirect to sign-in and come back to `next`. */
export async function requireCustomer(next = "/account"): Promise<Customer> {
  const c = await getCurrentCustomer();
  if (!c) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return c;
}

export async function signOutCustomer() {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

/** Save name / contact / delivery details the customer entered (e.g. at checkout). */
export async function updateCustomerProfile(id: string, patch: Partial<Pick<Customer, "name" | "email" | "phone" | "address" | "city" | "state">>) {
  const c = await getCustomer(id);
  if (!c) return null;
  const next: Customer = { ...c };
  if (patch.name) next.name = patch.name.slice(0, 80);
  if (patch.address) next.address = patch.address.slice(0, 200);
  if (patch.city) next.city = patch.city.slice(0, 60);
  if (patch.state) next.state = patch.state;
  // Only fill in contact details we don't have yet; verified ones aren't overwritten
  // and a phone/email can't be claimed if it already belongs to another account.
  if (patch.email && !c.email) {
    const email = patch.email.trim().toLowerCase();
    const owner = await findCustomer({ email });
    if (!owner || owner.id === c.id) next.email = email;
  }
  if (patch.phone && !c.phone) {
    const phone = normalizePhone(patch.phone);
    const owner = phone ? await findCustomer({ phone }) : null;
    if (phone && (!owner || owner.id === c.id)) next.phone = phone;
  }
  return saveCustomer(next);
}
