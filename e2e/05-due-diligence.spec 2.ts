import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

test.describe("Due Diligence Statements (E1/E2)", () => {
  test("list responds (rows or empty state)", async ({ page }) => {
    await page.goto("/due-diligence");
    await expectListResponded(page);
  });

  test("row opens DDS detail", async ({ page }) => {
    await page.goto("/due-diligence");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded DDS");
    await rows.first().click();
    await expect(page).toHaveURL(/\/due-diligence\/[^/]+$/);
  });

  test("create affordance opens the DDS form", async ({ page }) => {
    await page.goto("/due-diligence");
    await page.getByRole("button", { name: /new|add|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("DDS detail renders the statement and reflects its lifecycle state", async ({ page }) => {
    await page.goto("/due-diligence");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded DDS");
    await rows.first().click();
    await expect(page).toHaveURL(/\/due-diligence\/[^/]+$/);
    // Detail content responded.
    await expect(page.getByText(/risk assessments|risk conclusion/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Lifecycle is reflected: a status-appropriate action control OR the status itself
    // (actions like Submit/Approve/Reject/Withdraw/Edit are intentionally state-gated).
    const action = page.getByRole("button", { name: /submit|approve|reject|withdraw|edit|delete/i });
    const status = page.getByText(/draft|submitted|approved|rejected|withdrawn/i);
    await expect(action.first().or(status.first())).toBeVisible({ timeout: 15_000 });
  });
});
