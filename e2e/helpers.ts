import { expect, type Page } from "@playwright/test";
import { ADMIN_PASSWORD } from "../playwright.config";

/** A seed listing that always starts with several units (accessories are stocked 3-8). */
export const STOCKED_ID = "airpods-pro-2-1";

export async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"));
}

/** Request a sign-in code and type the on-screen development code. */
export async function customerSignIn(page: Page, identifier: string, next = "/account", expectPath = next) {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Phone number or email" }).first().fill(identifier);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const code = page.getByText(/your code is/i).locator("b");
  await expect(code).toBeVisible();
  await page.getByLabel("Digit 1").fill(await code.innerText());
  await page.waitForURL((u) => u.pathname === expectPath);
}

export async function addToCart(page: Page, productId = STOCKED_ID) {
  await page.goto(`/product/${productId}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await expect(page.getByRole("button", { name: /Cart, [1-9]/ }).first()).toBeVisible();
}

/** Fill checkout for hub pickup + bank transfer and place the order. Returns the order page URL. */
export async function checkoutPickupTransfer(page: Page, phone = "08031234567") {
  await page.goto("/checkout");
  // Checkout asks shoppers to sign in by default (Settings → requireAccountForCheckout).
  if (await page.getByRole("heading", { name: /sign in to check out/i }).isVisible()) {
    await customerSignIn(page, phone, "/checkout");
  }
  await page.locator('input[name="name"]').fill("Ada Lovelace");
  await page.locator('input[name="phone"]').fill(phone);
  await page.getByRole("radio", { name: /pick up at a hub/i }).check({ force: true });
  await page.getByRole("radio", { name: /bank transfer/i }).check({ force: true });
  await page.getByRole("button", { name: /place order/i }).click();
  await page.waitForURL(/\/order\/JDH-\d+\?t=/);
  return page.url();
}
