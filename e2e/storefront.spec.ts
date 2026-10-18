import { expect, test } from "@playwright/test";
import { STOCKED_ID } from "./helpers";

test("home, shop and product pages render", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/JDHub/i);
  await expect(page.getByRole("banner").first()).toBeVisible();

  await page.goto("/shop");
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();

  await page.goto(`/product/${STOCKED_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/AirPods/i);
  await expect(page.getByRole("button", { name: /add to cart/i }).first()).toBeEnabled();

  expect(errors, `uncaught page errors: ${errors.join("; ")}`).toEqual([]);
});

test("cart adds, opens and updates quantity", async ({ page }) => {
  await page.goto(`/product/${STOCKED_ID}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  const cartButton = page.getByRole("button", { name: /Cart, 1 item/ }).first();
  await expect(cartButton).toBeVisible();
  await cartButton.click();
  const drawer = page.getByRole("dialog", { name: "Cart" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: /Increase .* quantity/ }).first().click();
  await expect(drawer.getByLabel("Quantity 2")).toBeVisible();
});

test("unknown pages show the not-found page", async ({ page }) => {
  const res = await page.goto("/product/does-not-exist");
  expect(res?.status()).toBe(404);
});
