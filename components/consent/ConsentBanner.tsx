"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { applyAnalytics, CONSENT_CHANGE_EVENT, CONSENT_OPEN_EVENT, parseConsent, readConsentRaw, saveConsent } from "@/lib/consent";

// Cookie consent banner + settings panel (NDPA). Analytics is off until the visitor
// accepts. When the admin turns "require consent" off, no banner is shown and
// analytics runs unless the visitor turned it off in Cookie settings.

const SSR = "\u0000ssr";

function subscribe(cb: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ConsentBanner({ required }: { required: boolean }) {
  const raw = useSyncExternalStore(subscribe, readConsentRaw, () => SSR);
  const hydrated = raw !== SSR;
  const choice = hydrated ? parseConsent(raw) : null;
  const [panel, setPanel] = useState<null | { analytics: boolean }>(null);

  // "Cookie settings" links anywhere on the page open the panel.
  useEffect(() => {
    const open = () => setPanel({ analytics: parseConsent(readConsentRaw())?.analytics ?? !required });
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, [required]);

  // Consent not required by the admin: analytics on unless the visitor said no.
  useEffect(() => {
    if (hydrated && !required && !choice) applyAnalytics(true);
  }, [hydrated, required, choice]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const decide = (analytics: boolean) => {
    saveConsent(analytics);
    setPanel(null);
  };

  if (!hydrated) return null;

  if (panel) {
    return (
      <div className="fixed inset-0 z-[70] grid place-items-end bg-black/40 sm:place-items-center" onClick={() => setPanel(null)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-title"
          className="fade-in max-h-[90vh] w-full overflow-y-auto rounded-t-[24px] bg-white p-6 sm:max-w-lg sm:rounded-tile sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id="consent-title" className="display text-[22px]">
              Cookie settings
            </h2>
            <button onClick={() => setPanel(null)} className="rounded-full p-1 hover:bg-stage" aria-label="Close">
              <Icon name="close" size={20} />
            </button>
          </div>
          <p className="mt-2 text-[14px] text-ink-2">
            Choose which cookies JDHub may use. You can change this at any time from the Cookie settings link at the bottom of every page.
          </p>

          <div className="mt-6 divide-y divide-line rounded-tile border border-line">
            <div className="flex items-start gap-4 p-4">
              <div className="flex-1">
                <p className="font-bold">Essential</p>
                <p className="mt-1 text-[13px] text-ink-2">Sign-in, your cart and remembering this choice. Needed for the site to work.</p>
              </div>
              <span className="mt-0.5 text-[13px] font-bold text-muted">Always on</span>
            </div>
            <label className="flex cursor-pointer items-start gap-4 p-4">
              <div className="flex-1">
                <p className="font-bold">Analytics</p>
                <p className="mt-1 text-[13px] text-ink-2">PostHog helps us see which products people view and where checkout gets stuck. No name, phone or email is shared.</p>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={panel.analytics}
                onChange={(e) => setPanel({ analytics: e.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button onClick={() => decide(false)} className="btn btn-outline">
              Reject all
            </button>
            <button onClick={() => decide(true)} className="btn btn-outline">
              Accept all
            </button>
            <button onClick={() => decide(panel.analytics)} className="btn btn-primary sm:col-span-2">
              Save my choices
            </button>
          </div>
          <p className="mt-4 text-center text-[12px] text-muted">
            Read our{" "}
            <Link href="/cookies" onClick={() => setPanel(null)} className="underline underline-offset-2">
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy" onClick={() => setPanel(null)} className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (!required || choice) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fade-in fixed inset-x-3 bottom-3 z-[60] rounded-tile border border-line bg-white p-5 shadow-[0_8px_40px_rgba(0,0,0,0.14)] sm:inset-x-auto sm:left-6 sm:bottom-6 sm:max-w-md"
    >
      <p className="font-bold">We value your privacy</p>
      <p className="mt-1.5 text-[13px] text-ink-2">
        We use essential cookies to keep you signed in and remember your cart. With your permission we&apos;d also like to use analytics cookies to improve
        JDHub. Analytics stays off unless you accept.{" "}
        <Link href="/cookies" className="font-bold underline underline-offset-2">
          Cookie Policy
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => decide(true)} className="btn btn-primary flex-1">
          Accept
        </button>
        <button onClick={() => decide(false)} className="btn btn-outline flex-1">
          Reject
        </button>
        <button onClick={() => setPanel({ analytics: false })} className="btn btn-outline flex-1">
          Manage
        </button>
      </div>
    </div>
  );
}

/** "Cookie settings" link-style button that reopens the panel. */
export function CookieSettingsButton({ className = "inline-block py-1 hover:underline", children = "Cookie settings" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))} className={className}>
      {children}
    </button>
  );
}
