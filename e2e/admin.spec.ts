import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/admin.json" });
import { addToCart, checkoutPickupTransfer, customerSignIn } from "./helpers";

test("admin sees a new order and marks it paid", async ({ page, browser }) => {
  const shopper = await browser.newPage();
  await addToCart(shopper);
  const url = await checkoutPickupTransfer(shopper, "08035550002");
  const orderId = /\/order\/(JDH-\d+)/.exec(url)![1];
  await shopper.close();

  await page.goto("/admin");
  await page.goto(`/admin/orders/${orderId}`);
  await expect(page.getByText(orderId).first()).toBeVisible();
  await page.getByRole("button", { name: /mark (as )?paid/i }).first().click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: /mark (as )?paid|confirm/i });
  if (await confirm.count()) await confirm.first().click();
  await expect(page.getByText(/^paid$/i).first()).toBeVisible();
});

test("admin blocks a shopper, who is then signed out", async ({ page, browser }) => {
  const shopper = await browser.newPage();
  await customerSignIn(shopper, "0803 700 0010");

  await page.goto("/admin");
  await page.goto("/admin/customers?view=accounts&q=7000010");
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /block account/i }).click();
  await expect(page.getByRole("button", { name: "Unblock" })).toBeVisible();

  await shopper.goto("/account");
  await expect(shopper.getByRole("button", { name: /sign out/i })).toHaveCount(0);
  await shopper.close();

  await page.getByRole("button", { name: "Unblock" }).click();
  await expect(page.getByRole("button", { name: "Block", exact: true })).toBeVisible();
});

test("admin core pages load", async ({ page }) => {
  await page.goto("/admin");
  for (const path of ["/admin", "/admin/products", "/admin/inventory", "/admin/offers", "/admin/orders", "/admin/customers", "/admin/requests", "/admin/settings", "/admin/activity"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
  }
});
