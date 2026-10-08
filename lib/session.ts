// Signed session tokens (HMAC-SHA256 via Web Crypto). Kept free of server-only
// imports so proxy.ts can verify admin sessions before routes render.
//
// Admin and customer tokens are signed with different derived keys ("purpose"), so a
// customer token can never be replayed as an admin token or vice versa.

import type { Role } from "./types";

export const SESSION_COOKIE = "jd_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export const CUSTOMER_COOKIE = "jd_customer";
export const CUSTOMER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type Session = {
  sub: string;
  name: string;
  role: Role;
  exp: number;
  /** Credential fingerprint: changes when the password changes, revoking old sessions. */
  fp?: string;
  /** Global session epoch: bumping it in the store signs every admin out. */
  ep?: number;
};

export type CustomerSession = { sub: string; exp: number; ep?: number };

type Purpose = "admin" | "customer";

const enc = new TextEncoder();

function secret(): string | null {
  const s = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (s) return s;
  return process.env.NODE_ENV === "production" ? null : "jdhub-dev-secret";
}

export function authSecretAvailable() {
  return secret() !== null;
}

const b64url = (bytes: Uint8Array) => {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmacKey(purpose: Purpose, usage: KeyUsage[]) {
  const s = secret();
  if (!s) return null;
  const label = purpose === "admin" ? "jdhub-session" : "jdhub-customer";
  return crypto.subtle.importKey("raw", enc.encode(`${label}:${s}`), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

async function sign<T extends object>(purpose: Purpose, payload: T, ttlSeconds: number): Promise<string> {
  const key = await hmacKey(purpose, ["sign"]);
  if (!key) throw new Error("Set AUTH_SECRET (or ADMIN_PASSWORD) to enable sign-in.");
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

async function verify<T extends { exp: number }>(purpose: Purpose, token: string | undefined | null): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey(purpose, ["verify"]);
  if (!key) return null;
  try {
    const sigBytes = fromB64url(sig);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer,
      enc.encode(body),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as T;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signSession(session: Omit<Session, "exp">, ttlSeconds = SESSION_TTL_SECONDS) {
  return sign("admin", session, ttlSeconds);
}

/** Checks the signature and expiry only. Server code should use requireAdmin(), which also checks revocation. */
export function verifySession(token: string | undefined | null) {
  return verify<Session>("admin", token);
}

export function signCustomerSession(session: Omit<CustomerSession, "exp">, ttlSeconds = CUSTOMER_TTL_SECONDS) {
  return sign("customer", session, ttlSeconds);
}

export function verifyCustomerSession(token: string | undefined | null) {
  return verify<CustomerSession>("customer", token);
}

/** Short, non-reversible fingerprint of a credential, embedded in sessions for revocation. */
export async function fingerprint(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(`jdhub-fp:${value}`)));
  return b64url(digest).slice(0, 12);
}
