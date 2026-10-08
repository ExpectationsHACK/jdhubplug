// Strip personal data (phones, emails, session cookies, form bodies) from Sentry events.
// Isomorphic: used by the browser, server and edge Sentry configs.

import type { ErrorEvent } from "@sentry/nextjs";

const PHONE = /(\+?234|0)[789][01]\d{8}\b/g;
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi;

const scrubText = (s: string) => s.replace(PHONE, "[phone]").replace(EMAIL, "[email]");

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = scrubText(ex.value);
  }
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }
    if (event.request.query_string && typeof event.request.query_string === "string") {
      // Order links carry a secret token (?t=...).
      event.request.query_string = event.request.query_string.replace(/(^|&)t=[^&]*/g, "$1t=[redacted]");
    }
    if (event.request.url) event.request.url = event.request.url.replace(/([?&])t=[^&]*/g, "$1t=[redacted]");
  }
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = scrubText(b.message);
  }
  return event;
}
