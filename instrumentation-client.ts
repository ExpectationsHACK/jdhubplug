// Browser instrumentation: runs before the app becomes interactive.
//   Sentry  — error tracking (NEXT_PUBLIC_SENTRY_DSN)
//   PostHog — product analytics (NEXT_PUBLIC_POSTHOG_KEY), proxied through /ingest so
//             ad blockers don't drop events. Not even downloaded until the visitor
//             accepts analytics (lib/consent.ts, ConsentBanner).
// Both stay off until their keys are set.

import * as Sentry from "@sentry/nextjs";
import { syncAnalyticsWithConsent } from "./lib/consent";
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

// PostHog is loaded on demand, only after the visitor allows analytics (lib/posthog-client.ts).
syncAnalyticsWithConsent();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
