"use server";

import { redirect } from "next/navigation";
import { requestCode, signOutCustomer, verifyCode } from "@/lib/customer-auth";

export type CodeState =
  | { step: "identify"; error?: string }
  | { step: "verify"; identifier: string; display: string; channel: "sms" | "email"; devCode?: string; error?: string; resent?: boolean };

/** Only allow same-site relative redirects after sign-in. */
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/admin") ? next : "/account");

export async function sendCodeAction(identifier: string): Promise<CodeState> {
  const res = await requestCode(identifier);
  if (!res.ok) return { step: "identify", error: res.error };
  return { step: "verify", identifier, display: res.display, channel: res.channel, devCode: res.devCode };
}

export async function resendCodeAction(prev: Extract<CodeState, { step: "verify" }>): Promise<CodeState> {
  const res = await requestCode(prev.identifier);
  if (!res.ok) return { ...prev, error: res.error, resent: false };
  return { ...prev, devCode: res.devCode, error: undefined, resent: true };
}

export async function verifyCodeAction(prev: Extract<CodeState, { step: "verify" }>, code: string, next: string): Promise<CodeState> {
  const res = await verifyCode(prev.identifier, code);
  if (!res.ok) return { ...prev, error: res.error, resent: false };
  redirect(safeNext(next));
}

export async function signOutAction() {
  await signOutCustomer();
  redirect("/");
}
