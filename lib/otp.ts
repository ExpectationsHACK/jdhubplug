import "server-only";

import type { OtpChannel } from "./types";

// One-time code delivery.
//   SMS:   Termii (Nigerian SMS gateway) when TERMII_API_KEY is set.
//   Email: Resend when RESEND_API_KEY is set.
//   Dev:   outside production with no provider, the code is logged and shown on screen.

export type ChannelStatus = { sms: boolean; email: boolean; dev: boolean };

export function otpChannels(): ChannelStatus {
  const sms = !!process.env.TERMII_API_KEY;
  const email = !!process.env.RESEND_API_KEY;
  return { sms, email, dev: !sms && !email && process.env.NODE_ENV !== "production" };
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

  try {
    if (channel === "sms") {
      if (!c.sms) return { ok: false, error: "SMS sign-in isn't available. Use your email instead." };
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TERMII_API_KEY,
          to: to.replace(/^\+/, ""),
          from: process.env.TERMII_SENDER_ID || "JDHub",
          sms: text,
          type: "plain",
          // "dnd" reaches numbers on Nigeria's do-not-disturb list (needs an approved sender ID).
          channel: process.env.TERMII_CHANNEL || "dnd",
        }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Termii ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return { ok: true };
    }

    if (!c.email) return { ok: false, error: "Email sign-in isn't available. Use your phone number instead." };
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${storeName} <onboarding@resend.dev>`,
        to: [to],
        subject: `${code} is your ${storeName} sign-in code`,
        text,
        html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
  <p style="font-size:14px;color:#555">Your ${storeName} sign-in code</p>
  <p style="font-size:36px;font-weight:800;letter-spacing:8px;margin:12px 0">${code}</p>
  <p style="font-size:13px;color:#757575">It expires in 10 minutes. If you didn't ask for it, you can ignore this email. Never share this code with anyone.</p>
</div>`,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return { ok: true };
  } catch (e) {
    console.error("[otp] delivery failed", e);
    return { ok: false, error: "We couldn't send your code right now. Please try again in a minute." };
  }
}
