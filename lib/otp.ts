import "server-only";

import { escapeHtml, sendEmail, sendSms } from "./messaging";
import type { OtpChannel } from "./types";

// One-time code delivery.
//   SMS:   Termii (Nigerian SMS gateway) when TERMII_API_KEY is set.
//   Email: Resend when RESEND_API_KEY is set.
//   Dev:   outside production with no provider, the code is logged and shown on screen.

export type ChannelStatus = { sms: boolean; email: boolean; dev: boolean };

export function otpChannels(): ChannelStatus {
  const sms = !!process.env.TERMII_API_KEY;
  const email = !!process.env.RESEND_API_KEY;
  // Codes are shown on screen only in development, or in local production test runs
  // (OTP_DEV_CODES=1, e.g. the browser tests). Never on Vercel.
  const devAllowed = process.env.NODE_ENV !== "production" || (process.env.OTP_DEV_CODES === "1" && !process.env.VERCEL);
  return { sms, email, dev: !sms && !email && devAllowed };
}

/** True if shoppers can sign in at all in this environment. */
export function customerSignInAvailable() {
  const c = otpChannels();
  return c.sms || c.email || c.dev;
}

export type SendResult = { ok: true; devCode?: string } | { ok: false; error: string };

export async function sendOtp(channel: OtpChannel, to: string, code: string, storeName: string): Promise<SendResult> {
  const c = otpChannels();
  const text = `${code} is your ${storeName} sign-in code. It expires in 10 minutes. Never share it with anyone, including ${storeName} staff.`;

  if (c.dev) {
    console.info(`[otp] ${channel} code for ${to}: ${code}`);
    return { ok: true, devCode: code };
  }

  if (channel === "sms") {
    if (!c.sms) return { ok: false, error: "SMS sign-in isn't available. Use your email instead." };
    const r = await sendSms(to, text);
    return r.ok ? { ok: true } : { ok: false, error: "We couldn't send your code right now. Please try again in a minute." };
  }
  if (!c.email) return { ok: false, error: "Email sign-in isn't available. Use your phone number instead." };
  const r = await sendEmail({
    to,
    from: process.env.EMAIL_FROM || `${storeName} <onboarding@resend.dev>`,
    subject: `${code} is your ${storeName} sign-in code`,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
  <p style="font-size:14px;color:#555">Your ${escapeHtml(storeName)} sign-in code</p>
  <p style="font-size:36px;font-weight:800;letter-spacing:8px;margin:12px 0">${code}</p>
  <p style="font-size:13px;color:#757575">It expires in 10 minutes. If you didn't ask for it, you can ignore this email. Never share this code with anyone.</p>
</div>`,
  });
  return r.ok ? { ok: true } : { ok: false, error: "We couldn't send your code right now. Please try again in a minute." };
}
