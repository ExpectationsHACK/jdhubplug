import "server-only";

import { storageStatus } from "@/lib/store";

// Deployment checks for the dashboard's "System health" card. Only booleans and
// fix-it text leave the server: never the values of secrets.

export type HealthStatus = "ok" | "warn" | "bad" | "info";

export type HealthCheck = {
  id: string;
  label: string;
  status: HealthStatus;
  /** What the current state means, in one line. */
  detail: string;
  /** How to fix it (which Vercel setting to change). Omitted when nothing to do. */
  fix?: string;
};

const ENV_PATH = "Vercel → Project → Settings → Environment Variables";

export function systemHealth(): HealthCheck[] {
  const env = process.env;
  const storage = storageStatus();
  const isProd = env.NODE_ENV === "production";
  const paystackKey = env.PAYSTACK_SECRET_KEY ?? "";
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";

  const checks: HealthCheck[] = [
    storage.kind === "redis"
      ? { id: "storage", label: "Storage", status: "ok", detail: `${storage.label}: products, orders and settings are saved permanently.` }
      : storage.persistent
        ? { id: "storage", label: "Storage", status: "info", detail: storage.label, fix: storage.hint }
        : {
            id: "storage",
            label: "Storage",
            status: "bad",
            detail: `${storage.label}: edits and orders are lost on restart.`,
            fix: storage.hint ?? "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, run supabase/migrations/0001_jdhub_store.sql in the Supabase SQL editor, then redeploy.",
          },
    env.ADMIN_PASSWORD
      ? { id: "admin-password", label: "Owner password", status: "ok", detail: "ADMIN_PASSWORD is set." }
      : {
          id: "admin-password",
          label: "Owner password",
          status: isProd ? "bad" : "warn",
          detail: isProd ? "ADMIN_PASSWORD is missing, so nobody can sign in." : "Using the development password.",
          fix: `${ENV_PATH} → add ADMIN_PASSWORD (a long passphrase), then redeploy.`,
        },
    env.AUTH_SECRET
      ? { id: "auth-secret", label: "Session secret", status: "ok", detail: "AUTH_SECRET is set." }
      : {
          id: "auth-secret",
          label: "Session secret",
          status: "warn",
          detail: "Sessions are signed with the owner password instead of a dedicated secret.",
          fix: `${ENV_PATH} → add AUTH_SECRET (run \`openssl rand -hex 32\`), then redeploy.`,
        },
    !paystackKey
      ? {
          id: "paystack",
          label: "Card payments (Paystack)",
          status: "warn",
          detail: "Off. Buyers can still pay by bank transfer or WhatsApp.",
          fix: `${ENV_PATH} → add PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY from Paystack → Settings → API Keys.`,
        }
      : paystackKey.startsWith("sk_test_")
        ? {
            id: "paystack",
            label: "Card payments (Paystack)",
            status: "warn",
            detail: "Test mode: payments are simulated and no money moves.",
            fix: `${ENV_PATH} → replace PAYSTACK_SECRET_KEY with your live key (sk_live_…) when you're ready to sell.`,
          }
        : env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
          ? { id: "paystack", label: "Card payments (Paystack)", status: "ok", detail: "Live keys are set." }
          : {
              id: "paystack",
              label: "Card payments (Paystack)",
              status: "warn",
              detail: "The secret key is set but the public key is missing.",
              fix: `${ENV_PATH} → add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, then redeploy.`,
            },
    env.BLOB_READ_WRITE_TOKEN
      ? { id: "blob", label: "Image uploads", status: "ok", detail: "Vercel Blob is connected." }
      : {
          id: "blob",
          label: "Image uploads",
          status: "warn",
          detail: "Off. You can still paste image URLs on products.",
          fix: "Vercel → Storage → Blob → create a store and connect it to this project (adds BLOB_READ_WRITE_TOKEN).",
        },
    env.CRON_SECRET
      ? { id: "cron", label: "Daily clean-up (cron)", status: "ok", detail: "CRON_SECRET is set; only Vercel can trigger the sweep." }
      : {
          id: "cron",
          label: "Daily clean-up (cron)",
          status: "warn",
          detail: "The daily sweep works, but anyone can trigger it.",
          fix: `${ENV_PATH} → add CRON_SECRET (any long random string); Vercel Cron sends it automatically.`,
        },
    !siteUrl
      ? {
          id: "site-url",
          label: "Site address",
          status: "warn",
          detail: "NEXT_PUBLIC_SITE_URL is missing, so offer links and SEO use guesses.",
          fix: `${ENV_PATH} → add NEXT_PUBLIC_SITE_URL (e.g. https://jdhub.ng), then redeploy.`,
        }
      : !/^https:\/\//.test(siteUrl) && isProd
        ? {
            id: "site-url",
            label: "Site address",
            status: "warn",
            detail: `${siteUrl} isn't an https address.`,
            fix: `${ENV_PATH} → set NEXT_PUBLIC_SITE_URL to your https:// domain.`,
          }
        : { id: "site-url", label: "Site address", status: "ok", detail: siteUrl.replace(/\/$/, "") },
  ];

  return checks;
}

export function healthSummary(checks: HealthCheck[]) {
  const bad = checks.filter((c) => c.status === "bad").length;
  const warn = checks.filter((c) => c.status === "warn").length;
  return { bad, warn, ok: checks.length - bad - warn };
}
