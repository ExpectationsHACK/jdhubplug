import "server-only";

// Outbound email (Resend) and SMS (Termii). Shared by sign-in codes, order updates,
// back-in-stock alerts and sell/swap follow-ups. Without a provider, messages are
// logged (development) and reported as skipped, never as sent.

export type MessageResult = { ok: true; id?: string } | { ok: false; skipped?: boolean; error: string };

export function emailEnabled() {
  return !!process.env.RESEND_API_KEY;
}

export function smsEnabled() {
  return !!process.env.TERMII_API_KEY;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export { escapeHtml };

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; from?: string; replyTo?: string }): Promise<MessageResult> {
  if (!emailEnabled()) {
    if (process.env.NODE_ENV !== "production") console.info(`[email] (not sent, no RESEND_API_KEY) to ${msg.to}: ${msg.subject}`);
    return { ok: false, skipped: true, error: "Email isn't set up (RESEND_API_KEY)." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: msg.from || process.env.EMAIL_FROM || "JDHub <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject.slice(0, 200),
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[email] delivery failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}

/** Send an SMS to an E.164 (+234…) number. */
export async function sendSms(to: string, text: string): Promise<MessageResult> {
  if (!smsEnabled()) {
    if (process.env.NODE_ENV !== "production") console.info(`[sms] (not sent, no TERMII_API_KEY) to ${to}: ${text}`);
    return { ok: false, skipped: true, error: "SMS isn't set up (TERMII_API_KEY)." };
  }
  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TERMII_API_KEY,
        to: to.replace(/^\+/, ""),
        from: process.env.TERMII_SENDER_ID || "JDHub",
        sms: text.slice(0, 480),
        type: "plain",
        // "dnd" reaches numbers on Nigeria's do-not-disturb list (needs an approved sender ID).
        channel: process.env.TERMII_CHANNEL || "dnd",
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Termii ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json().catch(() => ({}))) as { message_id?: string };
    return { ok: true, id: data.message_id };
  } catch (e) {
    console.error("[sms] delivery failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "SMS failed" };
  }
}

/**
 * Branded HTML email shell (inline styles only, for email clients). `body` is trusted
 * HTML built by the caller; escape any user-provided text with escapeHtml first.
 */
export function emailLayout(opts: { storeName: string; preheader?: string; title: string; body: string; cta?: { label: string; href: string }; footer?: string }) {
  const { storeName, preheader = "", title, body, cta, footer } = opts;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#000">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="padding:24px 28px;border-bottom:1px solid #eee;font-size:20px;font-weight:800;letter-spacing:1px">${escapeHtml(storeName.toUpperCase())}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#333">${body}</div>
${cta ? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px">${escapeHtml(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:20px 28px;background:#fafafa;font-size:12px;line-height:1.5;color:#757575">${footer ?? `You're receiving this because of activity on your ${escapeHtml(storeName)} account or order.`}</td></tr>
</table></td></tr></table></body></html>`;
}
