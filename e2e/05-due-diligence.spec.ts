import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

test.describe("Due Diligence Statements (E1/E2)", () => {
  test("list responds (rows or empty state)", async ({ page }) => {
    await page.goto("/submissions");
    await expectListResponded(page);
  });

  test("row opens DDS detail", async ({ page }) => {
    await page.goto("/submissions");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded DDS");
    await rows.first().click();
    await expect(page).toHaveURL(/\/submissions\/[^/]+$/);
  });

  /**
   * DELIBERATE DEPRECATION — eudr-frontend#104/#109.
   *
   * There used to be a "New statement" button here that opened a lotless DDS
   * form. `commodities` is mandatory in the TRACES XSD, so every statement
   * that path produced was unfilable. It was retired, and the only supported
   * way to compose a statement is now from a purchase order and its lots.
   *
   * This test pins the retirement in both directions: the old dialog path
   * must stay gone, and the replacement entry point must still work. Do not
   * "fix" this by reinstating a create dialog — that is the defect.
   */
  test("the lotless create path stays retired; filing starts from a purchase order (#104/#109)", async ({ page }) => {
    await page.goto("/submissions");
    await expectListResponded(page);

    // The retired affordance: no control here opens a statement form.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(new|add|create).*statement/i })).toHaveCount(0);

    // The supported path, and it goes to Sourcing.
    const fileFromPo = page.getByRole("link", { name: /File from a purchase order/i });
    await expect(fileFromPo).toBeVisible({ timeout: 10_000 });
    await fileFromPo.click();
    await expect(page).toHaveURL(/\/sourcing$/);
  });

  test("DDS detail renders the statement and reflects its lifecycle state", async ({ page }) => {
    await page.goto("/submissions");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded DDS");
    await rows.first().click();
    await expect(page).toHaveURL(/\/submissions\/[^/]+$/);
    // Detail content responded.
    await expect(page.getByText(/risk assessments|risk conclusion/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Lifecycle is reflected: a status-appropriate action control OR the status itself
    // (actions like Submit/Approve/Reject/Withdraw/Edit are intentionally state-gated).
    // #39: `.first()` has to apply to the COMBINED `or()` locator, not to each operand
    // separately. E.g. when status is SUBMITTED, the "Withdraw" action button and a
    // "Submitted" status label (the header badge, *and* the TRACES panel's own
    // "Submitted — waiting for TRACES to resolve…" copy) are all on the page at once,
    // so `action.first().or(status.first())` still resolves the union to 2+ elements
    // and strict-mode-violates. Reducing the union itself to its first match keeps the
    // assertion unambiguous no matter how many candidates are present.
    const action = page.getByRole("button", { name: /approve|reject|withdraw|edit|delete/i });
    const status = page.getByText(/\b(draft|submitted|approved|rejected|withdrawn)\b/i);
    await expect(action.or(status).first()).toBeVisible({ timeout: 15_000 });
  });
});
