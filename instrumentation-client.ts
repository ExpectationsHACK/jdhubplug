// Browser instrumentation: runs before the app becomes interactive.
//   Sentry  — error tracking (NEXT_PUBLIC_SENTRY_DSN)
//   PostHog — product analytics (NEXT_PUBLIC_POSTHOG_KEY), proxied through /ingest so
//             ad blockers don't drop events.
// Both stay off until their keys are set.

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { scrubEvent } from "./lib/sentry-scrub";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: { deny: ["t", "token", "reference", "trxref"] } },
    beforeSend: scrubEvent,
    // Noise from browser extensions and flaky mobile networks.
    ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications", /Failed to fetch/i, /Load failed/i, /NetworkError/i],
  });
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  try {
    posthog.init(posthogKey, {
      api_host: "/ingest",
      ui_host: (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com"),
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      respect_dnt: true,
      // Admin screens are internal: don't track them or record them.
      before_send: (event) => (event && typeof window !== "undefined" && window.location.pathname.startsWith("/admin") ? null : event),
    });
  } catch (e) {
    console.warn("[analytics] PostHog failed to start", e);
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
