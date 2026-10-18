import posthog from "posthog-js";

// Cookie / analytics consent (browser only). The choice is stored first-party in the
// `jd_consent` cookie (mirrored to localStorage) as "<version>.<granted|denied>.<epoch ms>".
// Bump CONSENT_VERSION when the optional cookies change, so everyone is asked again.
//
// PostHog starts opted out (instrumentation-client.ts) and only captures after
// applyAnalytics(true). Essential cookies (session, cart, this one) need no consent.

export const CONSENT_COOKIE = "jd_consent";
export const CONSENT_VERSION = 1;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const CONSENT_CHANGE_EVENT = "jd:consent-change";
export const CONSENT_OPEN_EVENT = "jd:consent-open";

export type ConsentChoice = { version: number; analytics: boolean; at: number };

/** Raw stored value ("" when none). A primitive, so it can be a useSyncExternalStore snapshot. */
export function readConsentRaw(): string {
  if (typeof document === "undefined") return "";
  const fromCookie = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  if (fromCookie) return decodeURIComponent(fromCookie);
  try {
    return localStorage.getItem(CONSENT_COOKIE) ?? "";
  } catch {
    return "";
  }
}

/** The visitor's current choice, or null if they haven't chosen (or chose under an older version). */
export function parseConsent(raw: string): ConsentChoice | null {
  const [v, choice, at] = raw.split(".");
  if (Number(v) !== CONSENT_VERSION || (choice !== "granted" && choice !== "denied")) return null;
  return { version: CONSENT_VERSION, analytics: choice === "granted", at: Number(at) || 0 };
}

export const readConsent = () => parseConsent(readConsentRaw());

/** Save the visitor's choice and apply it to analytics immediately. */
export function saveConsent(analytics: boolean) {
  const value = `${CONSENT_VERSION}.${analytics ? "granted" : "denied"}.${Date.now()}`;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  try {
    localStorage.setItem(CONSENT_COOKIE, value);
  } catch {
    /* storage blocked: the cookie still works */
  }
  applyAnalytics(analytics);
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

const posthogReady = () => !!process.env.NEXT_PUBLIC_POSTHOG_KEY && typeof window !== "undefined" && posthog.__loaded;

/** Turn PostHog capturing on or off. Safe to call before PostHog has loaded or without a key. */
export function applyAnalytics(on: boolean) {
  if (!posthogReady()) return;
  try {
    if (on) {
      if (!posthog.has_opted_in_capturing()) posthog.opt_in_capturing({ captureEventName: false });
    } else if (!posthog.has_opted_out_capturing()) {
      posthog.opt_out_capturing();
    }
  } catch {
    /* analytics must never break the app */
  }
}

/**
 * Sync PostHog with the stored choice once it has loaded. With no choice yet,
 * reset PostHog to its default (opted out) so a stale opt-in can't leak through.
 */
export function syncAnalyticsWithConsent() {
  const choice = readConsent();
  if (choice) return applyAnalytics(choice.analytics);
  try {
    if (posthogReady()) posthog.clear_opt_in_out_capturing();
  } catch {
    /* ignore */
  }
}

/** True only when PostHog is loaded and the visitor has opted in. */
export function analyticsAllowed(): boolean {
  if (!posthogReady()) return false;
  try {
    return posthog.has_opted_in_capturing();
  } catch {
    return false;
  }
}

/** Reopen the cookie settings panel (footer link, cookie policy page). */
export function openConsentPanel() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
