import { defineConfig, devices } from "@playwright/test";

// Browser tests. They run against a production build (`npm run build` first) on the
// in-memory store, so every run starts from the seed catalog and nothing touches real data.
//   npm run build && npm run test:e2e

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const ADMIN_PASSWORD = "e2e-admin-password";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Visitors who already answered the cookie banner (analytics declined), so it doesn't cover the page.
    storageState: "e2e/consented.json",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /admin\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /storefront\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Always a fresh server: the store lives in its memory, so a reused one carries old state.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ADMIN_PASSWORD,
      AUTH_SECRET: "e2e-only-secret-not-for-production",
      OTP_DEV_CODES: "1",
      // Force a fresh in-memory store (no .data snapshot) even if the shell has real credentials.
      JDHUB_MEMORY_ONLY: "1",
      SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      RESEND_API_KEY: "",
      TERMII_API_KEY: "",
      PAYSTACK_SECRET_KEY: "",
      NEXT_PUBLIC_POSTHOG_KEY: "",
    },
  },
});
