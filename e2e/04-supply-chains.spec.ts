/**
 * E2E journeys: Sourcing list (readiness pipeline, tonnes coverage, deadline
 * placeholder — eudr-frontend #28, sourcing-readiness.design-prompt.md
 * Prompt A). Route stays `/supply-chains`; only the nav label and page
 * content are reframed as "Sourcing".
 *
 * The readiness endpoint (`GET /api/v1/supply-chain/batches/readiness/`,
 * eudr-app #60 / PR #83) is still in QA, not merged to `main` — so, like the
 * TRACES routes in `10-submissions.spec.ts`, it's intercepted with
 * `page.route` stubs for deterministic, offline-safe testing rather than
 * assumed live. Auth/nav/suppliers/products (existing, already-shipped
 * endpoints) still hit the real seeded backend.
 */

import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

const READY_PO = {
  id: "po-e2e-ready",
  reference_number: "PO-2026-E2E1",
  seller_id: "11111111-1111-1111-1111-111111111111",
  buyer_id: "22222222-2222-2222-2222-222222222222",
  commodity_id: "33333333-3333-3333-3333-333333333333",
  transaction_date: "2026-07-01",
  stage: "READY",
  blocked: false,
  blockers: [],
  funnel: {
    unit: "KG",
    ordered_quantity: "500000.0000",
    allocated_quantity: "300000.0000",
    geolocated_quantity: "280000.0000",
    filed_quantity: "250000.0000",
    uncovered_quantity: "250000.0000",
  },
  lot_count: 3,
};

const BLOCKED_PO = {
  ...READY_PO,
  id: "po-e2e-blocked",
  reference_number: "PO-2026-E2E2",
  stage: "ALLOCATED",
  blocked: true,
  blockers: [
    { code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 },
  ],
};

function routeReadiness(page: import("@playwright/test").Page, results: unknown[]) {
  return page.route("**/api/v1/supply-chain/batches/readiness/**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      json: { count: results.length, next: null, previous: null, total_pages: 1, results },
    });
  });
}

test.describe("Sourcing list (readiness pipeline, #28)", () => {
  test('sidebar "Sourcing" item navigates to /supply-chains', async ({ page }) => {
    await routeReadiness(page, []);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Sourcing" }).click();
    await expect(page).toHaveURL(/\/supply-chains/);
    await expect(page.getByRole("heading", { name: "Sourcing" })).toBeVisible();
  });

  test("list responds and renders stage badges + coverage", async ({ page }) => {
    await routeReadiness(page, [READY_PO, BLOCKED_PO]);
    await page.goto("/supply-chains");

    const rows = await expectListResponded(page);
    await expect(rows).toHaveCount(2);

    await expect(page.locator('[data-slot="badge"]', { hasText: "Ready to file" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "Blocked" })).toBeVisible();
    await expect(page.getByText("3 plots failed deforestation validation")).toBeVisible();

    // Coverage caption — native unit (KG here), not an invented tonnes
    // conversion. Tolerates both "250,000" and "250000" grouping (locale).
    // Both fixture rows share the same funnel, so two rows render it — assert
    // at least one, not exactly one.
    await expect(page.getByText(/250,?000\s*\/\s*500,?000\s*kg filed/).first()).toBeVisible();

    // Next-deadline placeholder — BE-B (#61) hasn't shipped the field yet.
    await expect(page.getByText("—").first()).toBeVisible();
  });

  test("empty state shows New purchase order + Connect a data source actions", async ({ page }) => {
    await routeReadiness(page, []);
    await page.goto("/supply-chains");

    await expect(page.getByText("No purchase orders yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "New purchase order" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect a data source" })).toBeVisible();
  });

  test('Stage filter "Blocked" option requests blocked=true (derived, not a stage value)', async ({ page }) => {
    await routeReadiness(page, [READY_PO]);
    await page.goto("/supply-chains");
    await expectListResponded(page);

    const nextRequest = page.waitForRequest(
      (req) => req.url().includes("/batches/readiness/") && req.url().includes("blocked=true"),
    );
    await page.getByLabel("Filter by stage").selectOption("BLOCKED");
    const req = await nextRequest;
    expect(req.url()).toContain("blocked=true");
    expect(req.url()).not.toContain("stage=BLOCKED");
  });

  test("row click opens the PO detail route", async ({ page }) => {
    await routeReadiness(page, [READY_PO]);
    await page.goto("/supply-chains");
    const rows = await expectListResponded(page);
    await rows.first().click();
    await expect(page).toHaveURL(/\/supply-chains\/[^/]+$/);
  });

  test("New purchase order sheet opens with the no-plots helper line", async ({ page }) => {
    await routeReadiness(page, []);
    await page.goto("/supply-chains");

    await page.getByRole("button", { name: "New purchase order" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/No plots are picked here/i)).toBeVisible();
  });
});
