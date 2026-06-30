import { test, expect } from "@playwright/test";

// The plots page is a custom map + card layout (not a DataTable): cards select a
// plot on the embedded Leaflet map in-page, rather than routing to a detail page.
const plotCards = (page: import("@playwright/test").Page) =>
  page.locator("div.group.cursor-pointer");

test.describe("Land Plots & Geolocation (B2/C1/C2)", () => {
  test("page loads the map and the plot card list", async ({ page }) => {
    await page.goto("/plots");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15_000 });
    const empty = page.getByText(/no land plots yet|no matching plots/i);
    await expect(plotCards(page).first().or(empty.first())).toBeVisible({ timeout: 15_000 });
  });

  test("selecting a plot highlights it on the map", async ({ page }) => {
    await page.goto("/plots");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15_000 });
    const cards = plotCards(page);
    const empty = page.getByText(/no land plots yet|no matching plots/i);
    // Wait for the query to settle (cards render a beat after the map) before counting.
    await expect(cards.first().or(empty.first())).toBeVisible({ timeout: 15_000 });
    test.skip((await cards.count()) === 0, "no seeded plots");
    await cards.first().click();
    await expect(cards.first()).toHaveClass(/border-primary/);
  });

  test("create affordance opens a form (GeoJSON entry)", async ({ page }) => {
    await page.goto("/plots");
    await page.getByRole("button", { name: /new|add|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
