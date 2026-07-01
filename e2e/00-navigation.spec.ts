import { test, expect } from "@playwright/test";

/** The primary sidebar workflows (app-sidebar.tsx). */
const NAV = [
  { name: "Dashboard", path: /\/dashboard/ },
  { name: "Suppliers", path: /\/suppliers/ },
  { name: "Land Plots", path: /\/plots/ },
  { name: "Supply Chains", path: /\/supply-chains/ },
  { name: "Submissions", path: /\/due-diligence/ },
  { name: "Documents", path: /\/documents/ },
  { name: "Integrations", path: /\/integrations/ },
];

test.describe("Navigation", () => {
  test("every primary nav item routes to its page", async ({ page }) => {
    await page.goto("/dashboard");
    for (const item of NAV) {
      await page.getByRole("link", { name: item.name, exact: true }).click();
      await expect(page).toHaveURL(item.path);
    }
  });
});
