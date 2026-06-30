import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

test.describe("Supply Chains & Batches (B3)", () => {
  test("list responds (rows or empty state)", async ({ page }) => {
    await page.goto("/supply-chains");
    await expectListResponded(page);
  });

  test("row opens detail with chain links", async ({ page }) => {
    await page.goto("/supply-chains");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded supply chains");
    await rows.first().click();
    await expect(page).toHaveURL(/\/supply-chains\/[^/]+$/);
  });

  test("create affordance opens a batch form", async ({ page }) => {
    await page.goto("/supply-chains");
    await page.getByRole("button", { name: /new|add|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
