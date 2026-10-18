import type { PostHog } from "posthog-js";

// PostHog is downloaded only when it's needed: a key is configured AND the visitor
// has allowed analytics. Visitors who decline (or haven't chosen) never load it,
// which keeps ~100 KB of JavaScript off every page.

let instance: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

export const posthogConfigured = () => !!process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** The loaded PostHog client, or null if it hasn't been loaded. */
export const getPosthog = () => (instance?.__loaded ? instance : null);

/** Load and start PostHog (once). Resolves to null without a key or outside the browser. */
export function loadPosthog(): Promise<PostHog | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return Promise.resolve(null);
  loading ??= import("posthog-js")
    .then(
      ({ default: posthog }) =>
        new Promise<PostHog>((resolve) => {
          posthog.init(key, {
            api_host: "/ingest",
            ui_host: (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(".i.posthog.com", ".posthog.com"),
            defaults: "2026-08-30",
            person_profiles: "identified_only",
            respect_dnt: true,
            // NDPA consent: nothing is captured or stored until the visitor is opted in.
            opt_out_capturing_by_default: true,
            opt_out_persistence_by_default: true,
            // Admin screens are internal: don't track them or record them.
            before_send: (event) => (event && window.location.pathname.startsWith("/admin") ? null : event),
            loaded: () => {
              instance = posthog;
              resolve(posthog);
            },
          });
        }),
    )
    .catch((e) => {
      console.warn("[analytics] PostHog failed to start", e);
      loading = null;
      return null;
    });
  return loading;
}
