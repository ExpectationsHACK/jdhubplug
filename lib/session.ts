// Signed admin session tokens (HMAC-SHA256 via Web Crypto). Kept free of
// server-only imports so proxy.ts can verify sessions before routes render.

import type { Role } from "./types";

export const SESSION_COOKIE = "jd_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type Session = { sub: string; name: string; role: Role; exp: number };

const enc = new TextEncoder();

function secret(): string | null {
  const s = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (s) return s;
  return process.env.NODE_ENV === "production" ? null : "jdhub-dev-secret";
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

async function hmacKey(usage: KeyUsage[]) {
  const s = secret();
  if (!s) return null;
  return crypto.subtle.importKey("raw", enc.encode(`jdhub-session:${s}`), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

export async function signSession(session: Omit<Session, "exp">, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const key = await hmacKey(["sign"]);
  if (!key) throw new Error("Set ADMIN_PASSWORD (and ideally AUTH_SECRET) to enable the admin.");
  const payload = b64url(enc.encode(JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const key = await hmacKey(["verify"]);
  if (!key) return null;
  try {
    const sigBytes = fromB64url(sig);
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer, enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    if (!s.exp || s.exp < Math.floor(Date.now() / 1000)) return null;
    return s;
  } catch {
    return null;
  }
}
