import { expect, test } from "@playwright/test";

/**
 * eudr-frontend#134: the plot → lot → purchase order → shipment chain was
 * modelled and never shown. This drives it end to end through the links,
 * never through a list, on the seed's one fully-chained plot:
 *
 *   PLOT-000017 → BCH-2026-014 → PO-2026-0223 → HLCU-990041 → DDS-2026-GH-010
 *
 * Live, unstubbed: the lineage endpoint (eudr-app#225) resolves every hop
 * server-side and the assertions are on seeded references.
 */
test.describe("Cross-links: plot → order → shipment → order (#134)", () => {
  test("from a plot, every hop of its chain is a link, and the loop closes", async ({ page }) => {
    // Plot → detail via the Open link (#133).
    await page.goto("/plots");
    const card = page.locator('[data-slot="plot-card"]', { hasText: "PLOT-000017" });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("link", { name: /^Open plot/ }).click();
    await expect(page).toHaveURL(/\/plots\/[^/?]+$/);

    // "Used by": lot, order, shipment, statement — all resolved, all links.
    const usedBy = page.getByText("Used by").locator("xpath=ancestor::*[@data-slot='card']");
    await expect(usedBy.getByRole("link", { name: "BCH-2026-014" })).toBeVisible({ timeout: 10_000 });
    await expect(usedBy.getByRole("link", { name: "HLCU-990041" })).toHaveAttribute("href", /\/shipments\//);
    await expect(usedBy.getByRole("link", { name: "DDS-2026-GH-010" })).toHaveAttribute("href", /\/submissions\//);

    // Plot → order.
    await usedBy.getByRole("link", { name: "PO-2026-0223" }).click();
    await expect(page).toHaveURL(/\/sourcing\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "PO-2026-0223" })).toBeVisible();

    // Order → shipment, via the lots table's group header.
    await page.getByRole("link", { name: "HLCU-990041" }).click();
    await expect(page).toHaveURL(/\/shipments\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "HLCU-990041" })).toBeVisible();

    // Shipment → order, via the lots table's Purchase order column. Loop closed.
    await page.getByRole("link", { name: "PO-2026-0223" }).click();
    await expect(page).toHaveURL(/\/sourcing\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: "PO-2026-0223" })).toBeVisible();
  });

  test("a plot no lot uses says so, rather than showing an empty table", async ({ page }) => {
    // PLOT-000013 is seeded with no lot on it.
    await page.goto("/plots");
    const card = page.locator('[data-slot="plot-card"]', { hasText: "PLOT-000013" });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("link", { name: /^Open plot/ }).click();
    await expect(page.getByText(/No lot uses this plot yet/)).toBeVisible({ timeout: 10_000 });
  });
});
