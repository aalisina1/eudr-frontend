import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

test.describe("Suppliers (B1)", () => {
  test("list responds (rows or empty state)", async ({ page }) => {
    await page.goto("/suppliers");
    await expectListResponded(page);
  });

  test("row opens supplier detail", async ({ page }) => {
    await page.goto("/suppliers");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded suppliers");
    await rows.first().click();
    await expect(page).toHaveURL(/\/suppliers\/[^/]+$/);
  });

  test("create affordance opens a form sheet", async ({ page }) => {
    await page.goto("/suppliers");
    await page.getByRole("button", { name: /new|add|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
