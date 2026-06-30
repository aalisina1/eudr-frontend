import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

test.describe("Documents & Evidence (F1)", () => {
  test("list responds (rows or empty state)", async ({ page }) => {
    await page.goto("/documents");
    await expectListResponded(page);
  });

  test("row opens document detail (version history)", async ({ page }) => {
    await page.goto("/documents");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded documents");
    await rows.first().click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);
  });

  test("create affordance opens a document form", async ({ page }) => {
    await page.goto("/documents");
    await page.getByRole("button", { name: /new|add|create|upload/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
