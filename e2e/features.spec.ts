import { expect, test } from "@playwright/test";
import { STOCKED_ID } from "./helpers";

test.describe("first visit", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("cookie banner asks before analytics and remembers the choice", async ({ page }) => {
    await page.goto("/");
    const reject = page.getByRole("button", { name: /reject/i }).first();
    await expect(reject).toBeVisible();
    await reject.click();
    await expect(reject).toBeHidden();
    await page.reload();
    await expect(page.getByRole("button", { name: /reject/i })).toHaveCount(0);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "jd_consent")?.value).toMatch(/denied/);
  });
});

test("legal pages are published and linked from the footer", async ({ page }) => {
  for (const path of ["/privacy", "/terms", "/returns", "/cookies"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: /privacy/i }).first()).toBeVisible();
});

test("wishlist keeps a saved product", async ({ page }) => {
  await page.goto(`/product/${STOCKED_ID}`);
  const heart = page.getByRole("button", { name: /wishlist|save/i }).first();
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await page.goto("/wishlist");
  await expect(page.getByText(/Galaxy Buds/i).first()).toBeVisible();
});

test("compare shows products side by side", async ({ page }) => {
  await page.goto(`/compare?ids=${STOCKED_ID},airpods-pro-2-2`);
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("sell estimate becomes a trade-in request with a status page", async ({ page }) => {
  await page.goto("/sell");
  await page.locator("#sell-model").selectOption({ index: 1 });
  await page.getByRole("button", { name: /^\d+(GB|TB)$/ }).first().click();
  await page.getByRole("button", { name: /^A Like New/ }).click();
  await page.getByRole("button", { name: /lock in this offer/i }).click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: /lock in my offer/i }) });
  await form.getByLabel(/name/i).first().fill("Tunde Seller");
  await form.getByLabel(/phone/i).first().fill("08036660001");
  await form.getByRole("button", { name: /lock in my offer/i }).click();
  const status = page.getByRole("link", { name: /status|track/i }).first();
  await expect(status).toBeVisible();
  await status.click();
  await expect(page).toHaveURL(/\/trade-in\/[^?]+\?t=/);
});

test.describe("admin", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("new admin pages load", async ({ page }) => {
  await page.goto("/admin");
  for (const path of ["/admin/notifications", "/admin/reviews", "/admin/alerts", "/admin/privacy", "/admin/requests"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
  }
});
});
