import { test, expect } from "@playwright/test";

test.describe("Dashboard (H1)", () => {
  test("dashboard loads and renders chart visuals", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    // SVG donut (DDS by status) + bar (plot validation) — no 3rd-party chart lib.
    await expect(page.locator("svg").first()).toBeVisible({ timeout: 15_000 });
  });
});
