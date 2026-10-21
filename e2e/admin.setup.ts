import { test as setup } from "@playwright/test";
import { adminLogin } from "./helpers";

// Sign in to the admin once and share the session, so the suite stays well under the
// login rate limit (10 attempts per IP per 15 minutes).
setup("admin session", async ({ page }) => {
  await adminLogin(page);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
