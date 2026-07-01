import { test, expect } from "@playwright/test";
import { CREDENTIALS, login } from "./helpers";

// These tests run unauthenticated — drop the shared storageState.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication (A1)", () => {
  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@canopy.test");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to a dashboard route redirects to login", async ({ page }) => {
    await page.goto("/suppliers");
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid credentials sign in and land authenticated", async ({ page }) => {
    await login(page, CREDENTIALS.compliance);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
