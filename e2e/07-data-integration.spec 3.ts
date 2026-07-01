import { test, expect } from "@playwright/test";

test.describe("Data Integration (G1–G6)", () => {
  test("integrations page loads with the 4 domain tabs", async ({ page }) => {
    await page.goto("/integrations");
    for (const tab of ["Sources", "Transformations", "Mappings", "Syncs"]) {
      await expect(page.getByRole("tab", { name: tab }).or(page.getByText(tab, { exact: true }).first())).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("add-source affordance opens a source form", async ({ page }) => {
    await page.goto("/integrations");
    await page.getByRole("button", { name: /new|add|create|source|connect/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
