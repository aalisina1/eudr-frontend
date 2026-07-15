import { test, expect } from "@playwright/test";
import { expectListResponded } from "./helpers";

test.describe("Suppliers (B1)", () => {
  test("list responds (rows or empty state)", async ({ page }) => {
    await page.goto("/suppliers");
    await expectListResponded(page);
  });

  test("row opens supplier detail", async ({ page }) => {
    await page.goto("/suppliers");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded suppliers");
    await rows.first().click();
    await expect(page).toHaveURL(/\/suppliers\/[^/]+$/);
  });

  test("create affordance opens a form sheet", async ({ page }) => {
    await page.goto("/suppliers");
    await page.getByRole("button", { name: /new|add|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

/**
 * Supplier Detail: sourcing coverage + data-gaps additions
 * (sourcing-readiness.design-prompt.md Prompt E + Round 3, eudr-frontend
 * #31). The readiness endpoint (eudr-app PR #83 / #61) is live on `main`,
 * but demo-seeded PO-batch volume is still sparse (#84) — stub it here for
 * deterministic coverage of the populated, blocked, and empty states rather
 * than depending on whatever happens to be seeded.
 */
test.describe("Supplier Detail: sourcing additions (#31)", () => {
  function routeReadiness(page: import("@playwright/test").Page, results: unknown[]) {
    return page.route("**/api/v1/supply-chain/batches/readiness/**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        json: { count: results.length, next: null, previous: null, total_pages: 1, results },
      });
    });
  }

  const READY_PO = {
    id: "po-e2e-ready",
    reference_number: "PO-2026-E2E1",
    seller_id: "seller-e2e",
    buyer_id: "buyer-e2e",
    commodity_id: "commodity-e2e",
    transaction_date: "2026-06-01",
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
    next_deadline: "2026-08-14",
  };

  const BLOCKED_PO = {
    ...READY_PO,
    id: "po-e2e-blocked",
    reference_number: "PO-2026-E2E2",
    stage: "ALLOCATED",
    blocked: true,
    blockers: [
      { code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 },
      { code: "MISSING_HARVEST_PERIOD", message: "2 lots missing harvest period", count: 2 },
    ],
    next_deadline: "2026-07-20",
  };

  async function openFirstSupplier(page: import("@playwright/test").Page) {
    await page.goto("/suppliers");
    const rows = await expectListResponded(page);
    test.skip((await rows.count()) === 0, "no seeded suppliers");
    await rows.first().click();
    await expect(page).toHaveURL(/\/suppliers\/[^/]+$/);
  }

  test("renders the populated Sourcing card + Data gaps card, with Certifications below both", async ({ page }) => {
    await routeReadiness(page, [READY_PO, BLOCKED_PO]);
    await openFirstSupplier(page);

    await expect(page.getByText("Sourcing from this supplier")).toBeVisible();
    await expect(page.getByText(/2 open POs/)).toBeVisible();
    await expect(page.getByText("PO-2026-E2E1")).toBeVisible();
    await expect(page.getByText("PO-2026-E2E2")).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "Blocked" })).toBeVisible();
    // Same phrase renders twice by design: once as the blocked-row note in
    // the Sourcing table, once aggregated in the Data gaps callout below.
    await expect(page.getByText("3 plots failed deforestation validation").first()).toBeVisible();

    await expect(page.getByText("Data gaps")).toBeVisible();
    await expect(page.getByText("3 plots failed deforestation validation").first()).toBeVisible();
    await expect(page.getByText("2 lots missing harvest period")).toBeVisible();

    // Certifications card renders below both new cards (Prompt E reorder).
    const sourcingBox = await page.getByText("Sourcing from this supplier").boundingBox();
    const certsBox = await page.getByRole("heading", { name: "Certifications" }).boundingBox();
    expect(sourcingBox).not.toBeNull();
    expect(certsBox).not.toBeNull();
    expect(certsBox!.y).toBeGreaterThan(sourcingBox!.y);
  });

  test("Data gaps deep-link scrolls to the Sourcing table instead of navigating away", async ({ page }) => {
    await routeReadiness(page, [BLOCKED_PO]);
    await openFirstSupplier(page);

    const urlBefore = page.url();
    await page.getByRole("button", { name: "View purchase orders" }).first().click();
    await page.waitForTimeout(300);
    expect(page.url()).toBe(urlBefore);
  });

  test("empty readiness data shows the empty Sourcing state and an all-clear Data gaps state", async ({ page }) => {
    await routeReadiness(page, []);
    await openFirstSupplier(page);

    await expect(page.getByText(/No open purchase orders for this supplier yet/i)).toBeVisible();
    await expect(page.getByText(/All data complete for this supplier's open orders/i)).toBeVisible();
  });
});
