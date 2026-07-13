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

  // eudr-app #72 (role/organization_id/organization_name on /auth/users/me/)
  // + its #70 FE rider — the Profile card must render the real values for
  // the signed-in user (compliance officer per auth.setup.ts), not blanks.
  test("Profile card shows the real role and organization from /auth/users/me/ (#72/#70)", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Profile", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Compliance Officer")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Canopy Trading GmbH")).toBeVisible({ timeout: 10_000 });
  });
});
