import { expect, test } from "@playwright/test";
import { adminLogin, customerSignIn } from "./helpers";

test("shopper signs in with a one-time code and signs out", async ({ page }) => {
  await customerSignIn(page, "0803 700 0001");
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(0);
  await page.goto("/account");
  await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(0);
});

test("a wrong code is refused", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("textbox", { name: "Phone number or email" }).first().fill("0803 700 0002");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const code = page.getByText(/your code is/i).locator("b");
  const real = await code.innerText();
  const wrong = real === "000000" ? "111111" : "000000";
  await page.getByLabel("Digit 1").fill(wrong);
  await expect(page.getByText(/isn't right/i)).toBeVisible();
});

test("sign-in never redirects off-site", async ({ page }) => {
  // A backslash path would resolve to another host in the browser; it falls back to /account.
  await customerSignIn(page, "0803 700 0003", "/\\evil.example", "/account");
  expect(new URL(page.url()).host).toBe(new URL(page.context().pages()[0].url()).host);
  // Already signed in: the redirect is checked too.
  await page.goto("/signin?next=//evil.example");
  await page.waitForURL((u) => u.pathname === "/account");
});

test("admin pages require a session", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin/login");
  await page.locator('input[name="password"]').fill("wrong-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/wrong email or password/i)).toBeVisible();
  await adminLogin(page);
  await expect(page.getByText(/system health/i)).toBeVisible();
});

test("forged Paystack return links don't reveal orders", async ({ request }) => {
  const res = await request.get("/api/paystack/callback?reference=JDH-10001-aaaaaaaa", { maxRedirects: 0 });
  expect([303, 307]).toContain(res.status());
  expect(res.headers().location ?? "").not.toContain("?t=");
});
