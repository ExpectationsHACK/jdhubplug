import { expect, test } from "@playwright/test";
import { addToCart, checkoutPickupTransfer, customerSignIn } from "./helpers";

test("checkout places an order that can be tracked", async ({ page, request }) => {
  await addToCart(page);
  const orderUrl = await checkoutPickupTransfer(page, "08035550001");
  const orderId = /\/order\/(JDH-\d+)/.exec(orderUrl)![1];

  await expect(page.getByText(orderId).first()).toBeVisible();
  await expect(page.getByText(/bank transfer/i).first()).toBeVisible();

  // Order page needs the secret token.
  const bare = await request.get(`/order/${orderId}`);
  expect([200, 404]).toContain(bare.status());
  expect(await bare.text()).not.toContain("Ada Lovelace");

  // Track by number + phone.
  await page.goto("/track");
  await page.locator("#track-id").fill(orderId);
  await page.locator("#track-phone").fill("0803 555 0001");
  await page.getByRole("button", { name: /track/i }).click();
  await page.waitForURL(new RegExp(`/order/${orderId}\\?t=`));

  // A wrong phone gets a generic message.
  await page.goto("/track");
  await page.locator("#track-id").fill(orderId);
  await page.locator("#track-phone").fill("0809 999 9999");
  await page.getByRole("button", { name: /track/i }).click();
  await expect(page.getByText(/couldn't find an order/i)).toBeVisible();
});

test("checkout validates required fields", async ({ page }) => {
  await customerSignIn(page, "0803 555 0009");
  await addToCart(page);
  await page.goto("/checkout");
  await page.locator('input[name="name"]').fill("");
  await page.getByRole("button", { name: /place order|pay/i }).click();
  await expect(page.locator('input[name="name"]')).toBeFocused();
  await expect(page).toHaveURL(/\/checkout/);
});

test("checkout asks for sign-in by default", async ({ page }) => {
  await addToCart(page);
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { name: /sign in to check out/i })).toBeVisible();
});
