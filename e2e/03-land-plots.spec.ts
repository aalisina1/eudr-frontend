import { test, expect } from "@playwright/test";

// The plots page is a custom map + card layout (not a DataTable): cards select a
// plot on the embedded Leaflet map in-page, rather than routing to a detail page.
// #133 moved the click target inside the card (a real <button>), so the card
// is located by its slot rather than by a cursor class.
const plotCards = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="plot-card"]');

test.describe("Land plots & Geolocation (B2/C1/C2)", () => {
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

/**
 * eudr-frontend#133: there was no path from the list to `/plots/[id]` — a card
 * click only highlighted the map. Decision: the card still selects (the map is
 * the point of the list), and each card carries a distinct Open link. This
 * drives list → detail → back, by mouse and by keyboard.
 */
test.describe("Land plots → plot detail → back (#133)", () => {
  test("the Open link reaches the detail page, which links back to the list", async ({ page }) => {
    await page.goto("/plots");
    const cards = plotCards(page);
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const firstOpen = page.getByRole("link", { name: /^Open plot / }).first();
    const ref = (await firstOpen.getAttribute("aria-label"))!.replace("Open plot ", "");

    await firstOpen.click();
    await expect(page).toHaveURL(/\/plots\/[^/?]+$/);
    await expect(page.getByRole("heading", { name: ref })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Land plots/ }).click();
    await expect(page).toHaveURL(/\/plots$/);
    await expect(cards.first()).toBeVisible();
  });

  test("selecting a card by keyboard does not navigate; the Open link is a separate tab stop", async ({ page }) => {
    await page.goto("/plots");
    const cards = plotCards(page);
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const selectBtn = cards.first().getByRole("button");
    await selectBtn.focus();
    await page.keyboard.press("Enter");
    await expect(selectBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/plots$/);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /^Open plot / }).first()).toBeFocused();
  });
});
