import { type Page, expect } from "@playwright/test";

/** Seeded demo logins (password `canopy2025`); see backend `seed_demo_data`. */
export const CREDENTIALS = {
  compliance: { email: "maria@canopy.test", password: "canopy2025" },
  admin: { email: "admin@canopy.test", password: "canopy2025" },
  viewer: { email: "viewer@canopy.test", password: "canopy2025" },
} as const;

/** Log in through the real login form. */
export async function login(
  page: Page,
  creds: { email: string; password: string } = CREDENTIALS.compliance,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

/**
 * Assert a DataTable list page is "responding": either it rendered real data
 * rows OR an explicit empty state — both prove the page mounted and the fetch
 * resolved (vs. an infinite spinner / white screen, which the quality bar
 * forbids). Returns the clickable data-row locator.
 *
 * Real data rows carry `cursor-pointer` (pages pass `onRowClick`); loading
 * skeleton rows do not, and the empty state is a single `td[colspan]`.
 */
export async function expectListResponded(page: Page) {
  // Let any loading skeletons clear (no-op if there are none).
  await page
    .locator("table tbody .animate-pulse")
    .first()
    .waitFor({ state: "detached" })
    .catch(() => {});
  const dataRows = page.locator("table tbody tr.cursor-pointer");
  const emptyState = page.locator("table tbody td[colspan]");
  await expect(dataRows.first().or(emptyState.first())).toBeVisible({ timeout: 15_000 });
  return dataRows;
}
