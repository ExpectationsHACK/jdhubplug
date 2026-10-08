import * as Sentry from "@sentry/nextjs";

// Server-side instrumentation: start Sentry for the runtime this server instance uses.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Report errors thrown while rendering Server Components, Server Actions and route handlers.
export const onRequestError = Sentry.captureRequestError;
