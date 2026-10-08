import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type Session } from "./session";
import { clearLoginFailures, findStaffByEmail, loginFailures, logAudit, recordLoginFailure, saveStaff } from "./store";
import type { Role, StaffUser } from "./types";

// Admin authentication and permissions.
//
// The owner signs in with ADMIN_PASSWORD (env). The owner can then create staff
// accounts (manager / support) with their own email + password, stored hashed
// (PBKDF2-SHA256) in the store. Every admin page and Server Action calls
// requireAdmin(), so access is checked server-side even if proxy.ts is bypassed.

export type Permission =
  | "products:write"
  | "inventory:write"
  | "orders:write"
  | "offers:write"
  | "leads:write"
  | "settings:write"
  | "staff:manage"
  | "danger";

const ROLE_PERMS: Record<Role, Permission[]> = {
  owner: ["products:write", "inventory:write", "orders:write", "offers:write", "leads:write", "settings:write", "staff:manage", "danger"],
  manager: ["products:write", "inventory:write", "orders:write", "offers:write", "leads:write", "settings:write"],
  support: ["orders:write", "leads:write"],
};

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", manager: "Manager", support: "Support" };

export function can(role: Role, perm: Permission) {
  return ROLE_PERMS[role].includes(perm);
}

/** The owner password, or null if the admin isn't configured (production without ADMIN_PASSWORD). */
export function ownerPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV === "production" ? null : "jdhub-admin";
}

export function adminConfigured() {
  return ownerPassword() !== null;
}

export function usingDevPassword() {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}

// ----------------------------------------------------------------- Passwords

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string, salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 120_000 }, key, 256);
  return { hash: hex(bits), salt };
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// ------------------------------------------------------------------ Sessions

export async function getSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Require a signed-in admin (optionally with a permission). Redirects to the login
 * page when signed out; throws when signed in without the permission.
 */
export async function requireAdmin(perm?: Permission): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (perm && !can(s.role, perm)) throw new Error("You don't have permission to do that.");
  return s;
}

async function clientKey() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}

export type LoginResult = { ok: true; session: Session } | { ok: false; error: string };

/** Verify credentials and set the session cookie. Use from a Server Action. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const ip = await clientKey();
  if ((await loginFailures(ip)) >= 8) return { ok: false, error: "Too many attempts. Wait 15 minutes and try again." };

  const owner = ownerPassword();
  if (!owner) return { ok: false, error: "The admin isn't set up yet. Add ADMIN_PASSWORD in your Vercel environment variables." };

  let session: Omit<Session, "exp"> | null = null;
  const e = email.trim().toLowerCase();

  if (!e || e === (process.env.ADMIN_EMAIL ?? "").toLowerCase() || e === "owner") {
    if (safeEqual(password, owner)) session = { sub: "owner", name: "Owner", role: "owner" };
  }
  if (!session && e) {
    const user = await findStaffByEmail(e);
    if (user?.active) {
      const { hash } = await hashPassword(password, user.salt);
      if (safeEqual(hash, user.passwordHash)) {
        session = { sub: user.id, name: user.name, role: user.role };
        await saveStaff({ ...user, lastLoginAt: new Date().toISOString() } satisfies StaffUser);
      }
    }
  }

  if (!session) {
    await recordLoginFailure(ip);
    return { ok: false, error: "Wrong email or password." };
  }

  await clearLoginFailures(ip);
  const token = await signSession(session);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  await logAudit({ by: session.name, action: "auth.login", detail: `role ${session.role}` }).catch(() => undefined);
  return { ok: true, session: { ...session, exp: 0 } };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Record an admin action in the activity log. */
export async function audit(s: Session, action: string, target?: string, detail?: string) {
  await logAudit({ by: `${s.name} (${ROLE_LABEL[s.role]})`, action, target, detail }).catch(() => undefined);
}
