"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort error screen when the root layout itself fails. Reports to Sentry.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-NG">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", textAlign: "center", padding: 16 }}>
        <div>
          <p style={{ fontWeight: 800, letterSpacing: "0.14em", fontSize: 22 }}>JDHUB</p>
          <h1 style={{ fontSize: 28, margin: "24px 0 8px" }}>Something went wrong.</h1>
          <p style={{ color: "#555" }}>We&apos;ve been notified and are looking into it.</p>
          <button onClick={reset} style={{ marginTop: 24, background: "#000", color: "#fff", border: 0, borderRadius: 9999, padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
          {error.digest && <p style={{ marginTop: 16, fontSize: 12, color: "#999" }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
