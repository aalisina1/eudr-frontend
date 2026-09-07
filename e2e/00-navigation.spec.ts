import { test, expect } from "@playwright/test";

/** The primary sidebar workflows (app-sidebar.tsx). */
const NAV = [
  { name: "Dashboard", path: /\/dashboard/ },
  { name: "Suppliers", path: /\/suppliers/ },
  { name: "Land plots", path: /\/plots/ },
  { name: "Sourcing", path: /\/sourcing/ }, // renamed from "Supply Chains", #28
  { name: "Submissions", path: /\/submissions/ },
  { name: "Documents", path: /\/documents/ },
  // Integrations left the primary nav in #174: it is organisation
  // configuration, so it lives in the admin context. Its replacement path is
  // asserted in 14-administration.spec.ts, and below.
];

test.describe("Navigation", () => {
  test("every primary nav item routes to its page", async ({ page }) => {
    await page.goto("/dashboard");
    for (const item of NAV) {
      await page.getByRole("link", { name: item.name, exact: true }).click();
      await expect(page).toHaveURL(item.path);
    }
  });

  test("Integrations is reachable, from the admin context (#174)", async ({ page }) => {
    const { CREDENTIALS, login } = await import("./helpers");
    await login(page, CREDENTIALS.admin);
    await page.goto("/dashboard");

    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await page.getByRole("link", { name: "Integrations", exact: true }).click();

    await expect(page).toHaveURL(/\/integrations/);
  });
});

/**
 * eudr-frontend#121: /supply-chains and /due-diligence were labelled
 * "Sourcing" and "Submissions" in the nav — the URL in every demo disagreed
 * with the screen. The routes now match the labels, and the old paths
 * redirect so pre-rename bookmarks and shared links still land.
 */
test.describe("Routes match their nav labels (#121)", () => {
  test("the nav lands on /sourcing and /submissions", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Sourcing" }).click();
    await expect(page).toHaveURL(/\/sourcing$/);
    await page.getByRole("link", { name: "Submissions" }).click();
    await expect(page).toHaveURL(/\/submissions$/);
  });

  test("the old list paths redirect", async ({ page }) => {
    await page.goto("/supply-chains");
    await expect(page).toHaveURL(/\/sourcing$/);
    await page.goto("/due-diligence");
    await expect(page).toHaveURL(/\/submissions$/);
  });

  test("an old detail link redirects to the same object", async ({ page }) => {
    await page.goto("/sourcing");
    const firstRow = page.locator("tr.cursor-pointer").first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/sourcing\/[^/?]+$/);
    const id = page.url().split("/sourcing/")[1];
    await page.goto(`/supply-chains/${id}`);
    await expect(page).toHaveURL(new RegExp(`/sourcing/${id}$`));
  });
});
