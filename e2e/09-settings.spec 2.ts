import { test, expect } from "@playwright/test";

test.describe("Settings & Admin (A2/I1)", () => {
  test("settings page loads with profile content", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    // Page mounted with the dashboard chrome + some settings/profile content.
    await expect(
      page.getByRole("heading", { name: /settings|profile|account/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
