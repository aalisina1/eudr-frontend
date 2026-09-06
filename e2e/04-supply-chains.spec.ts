/**
 * E2E journeys: Sourcing list (readiness pipeline, tonnes coverage, deadline
 * placeholder — eudr-frontend #28, sourcing-readiness.design-prompt.md
 * Prompt A). Route stays `/sourcing`; only the nav label and page
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
  product_id: "33333333-3333-3333-3333-333333333333",
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
  next_deadline: null,
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
  test('sidebar "Sourcing" item navigates to /sourcing', async ({ page }) => {
    await routeReadiness(page, []);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Sourcing" }).click();
    await expect(page).toHaveURL(/\/sourcing/);
    await expect(page.getByRole("heading", { name: "Sourcing" })).toBeVisible();
  });

  test("list responds and renders stage badges + coverage", async ({ page }) => {
    await routeReadiness(page, [READY_PO, BLOCKED_PO]);
    await page.goto("/sourcing");

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
    await page.goto("/sourcing");

    await expect(page.getByText("No purchase orders yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "New purchase order" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect a data source" })).toBeVisible();
  });

  test('Stage filter "Blocked" option requests blocked=true (derived, not a stage value)', async ({ page }) => {
    await routeReadiness(page, [READY_PO]);
    await page.goto("/sourcing");
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
    await page.goto("/sourcing");
    const rows = await expectListResponded(page);
    await rows.first().click();
    await expect(page).toHaveURL(/\/sourcing\/[^/]+$/);
  });

  test("New purchase order sheet opens with the no-plots helper line", async ({ page }) => {
    await routeReadiness(page, []);
    await page.goto("/sourcing");

    await page.getByRole("button", { name: "New purchase order" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/No plots are picked here/i)).toBeVisible();
  });
});

/**
 * E2E journeys: PO Detail (eudr-frontend #29, sourcing-readiness.design-
 * prompt.md Prompt B) — the coverage funnel, "what's blocking readiness"
 * checklist, gated File DDS CTA, and the lots table. Same route as before
 * (`/sourcing/[id]`), restructured content.
 *
 * The readiness DETAIL endpoint (`GET /api/v1/supply-chain/batches/{id}/
 * readiness/`, eudr-app #60/#61) is stubbed the same way as the list above —
 * deterministic, offline-safe, and independent of whether #84's seed data has
 * landed yet. Two fixtures mirror the design snapshot's two preview frames:
 * "Ready to file" (no blockers) and "Gaps" (earlier stage, Blocked overlay).
 */
const READY_DETAIL = {
  id: "po-e2e-detail-ready",
  reference_number: "PO-2026-E2E9",
  seller_id: "44444444-4444-4444-4444-444444444444",
  buyer_id: "22222222-2222-2222-2222-222222222222",
  product_id: "33333333-3333-3333-3333-333333333333",
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
  lot_count: 2,
  next_deadline: null,
  lots: [
    {
      id: "lot-e2e-1",
      reference_number: "LOT-GH-26-0871",
      quantity: "25000.0000",
      unit: "KG",
      harvest_period_start: "2025-10-01",
      harvest_period_end: "2025-12-01",
      plot_count: 23,
      plots_resolved: true,
      plots_failed_count: 0,
      plots_pending_count: 0,
      filed: false,
      filing_dds_id: null,
      filing_dds_reference: "",
    },
    {
      id: "lot-e2e-2",
      reference_number: "LOT-GH-26-0772",
      quantity: "25000.0000",
      unit: "KG",
      harvest_period_start: "2025-10-01",
      harvest_period_end: "2025-12-01",
      plot_count: 142,
      plots_resolved: true,
      plots_failed_count: 0,
      plots_pending_count: 0,
      filed: true,
      filing_dds_id: "dds-e2e-1",
      filing_dds_reference: "DDS-2026-0047",
    },
  ],
};

const GAPS_DETAIL = {
  ...READY_DETAIL,
  id: "po-e2e-detail-gaps",
  reference_number: "PO-2026-E2E8",
  stage: "ALLOCATED",
  blocked: true,
  blockers: [
    { code: "MISSING_HARVEST_PERIOD", message: "2 lots missing harvest period", count: 2 },
    { code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 },
  ],
  lots: [
    {
      id: "lot-e2e-1",
      reference_number: "LOT-GH-26-0871",
      quantity: "25000.0000",
      unit: "KG",
      harvest_period_start: null,
      harvest_period_end: null,
      plot_count: 23,
      plots_resolved: true,
      plots_failed_count: 3,
      plots_pending_count: 0,
      filed: false,
      filing_dds_id: null,
      filing_dds_reference: "",
    },
  ],
};

const SUPPLIER_STUB = { id: READY_DETAIL.seller_id, name: "Kuapa Kokoo Union", country_of_origin: "GH" };
const PRODUCT_STUB = { id: READY_DETAIL.product_id, commodity_name: "Cocoa", description: "Fermented cocoa beans" };

function routeReadinessDetail(page: import("@playwright/test").Page, detail: unknown) {
  return page.route("**/api/v1/supply-chain/batches/*/readiness/**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ json: detail });
  });
}

async function stubLookups(page: import("@playwright/test").Page) {
  await page.route(`**/api/v1/suppliers/${SUPPLIER_STUB.id}/`, async (route) => {
    await route.fulfill({ json: SUPPLIER_STUB });
  });
  await page.route(`**/api/v1/commodities/products/${PRODUCT_STUB.id}/`, async (route) => {
    await route.fulfill({ json: PRODUCT_STUB });
  });
}

test.describe("PO Detail — Ready to file state (#29)", () => {
  test("shows the coverage funnel, all-clear checklist, and an enabled File DDS CTA", async ({ page }) => {
    await routeReadinessDetail(page, READY_DETAIL);
    await stubLookups(page);
    await page.goto(`/sourcing/${READY_DETAIL.id}`);

    await expect(page.getByRole("heading", { name: "PO-2026-E2E9" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "Ready to file" })).toBeVisible();
    // "Kuapa Kokoo Union" appears both in the header summary line and the
    // Provenance card's supplier link further down the page.
    await expect(page.getByText("Kuapa Kokoo Union").first()).toBeVisible();

    // Coverage funnel — five labelled rows.
    await expect(page.getByText("Coverage")).toBeVisible();
    for (const label of ["Ordered", "Allocated", "Geolocated", "Filed", "Uncovered"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // All-clear readiness checklist.
    // Copy updated by #118 (em dashes removed from user-visible strings); this
    // asserts the replacement wording, not the retired one.
    await expect(page.getByText("All data complete. This PO is ready to file.")).toBeVisible();

    // Lots table, grouped-by-shipment fallback (no shipment data yet) renders flat.
    await expect(page.getByText("LOT-GH-26-0871")).toBeVisible();
    await expect(page.getByText("DDS-2026-0047")).toBeVisible();
    await expect(page.getByText("Not filed")).toBeVisible();

    // Provenance card.
    await expect(page.getByText("Map renders at runtime")).toBeVisible();

    // File DDS CTA — enabled, routes to Submissions with the PO context.
    const fileDdsBtn = page.getByRole("button", { name: "File DDS" });
    await expect(fileDdsBtn).toBeEnabled();
    await fileDdsBtn.click();
    await expect(page).toHaveURL(new RegExp(`/submissions\\?po=${READY_DETAIL.id}`));
  });

  test("back link returns to the Sourcing list", async ({ page }) => {
    await routeReadinessDetail(page, READY_DETAIL);
    await stubLookups(page);
    await page.goto(`/sourcing/${READY_DETAIL.id}`);
    await expect(page.getByRole("heading", { name: "PO-2026-E2E9" })).toBeVisible();

    await page.getByRole("button", { name: "All purchase orders" }).click();
    await expect(page).toHaveURL(/\/sourcing$/);
  });
});

test.describe("PO Detail — Gaps (earlier stage, blocked) state (#29)", () => {
  test("itemises blockers, disables File DDS with a tooltip naming what's missing", async ({ page }) => {
    await routeReadinessDetail(page, GAPS_DETAIL);
    await stubLookups(page);
    await page.goto(`/sourcing/${GAPS_DETAIL.id}`);

    await expect(page.getByRole("heading", { name: "PO-2026-E2E8" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "Blocked" })).toBeVisible();

    // Concrete gap rows with their deep-link ghost buttons.
    await expect(page.getByText("2 lots missing harvest period")).toBeVisible();
    await expect(page.getByText("3 plots failed deforestation validation")).toBeVisible();
    await expect(page.getByRole("button", { name: /Fix/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Review plots/ })).toBeVisible();

    // The lot's own Missing/failed badges in the lots table.
    await expect(page.locator('[data-slot="badge"]', { hasText: "Missing" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "3 failed" })).toBeVisible();

    // File DDS is disabled outside READY, with a Tooltip naming what's missing.
    const fileDdsBtn = page.getByRole("button", { name: "File DDS" });
    await expect(fileDdsBtn).toBeDisabled();
    await fileDdsBtn.hover({ force: true });
    await expect(page.getByText("2 lots missing harvest period · 3 plots failed deforestation validation")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("File DDS tooltip opens on keyboard Tab focus (not just mouse hover), and Enter does not navigate", async ({ page }) => {
    await routeReadinessDetail(page, GAPS_DETAIL);
    await stubLookups(page);
    await page.goto(`/sourcing/${GAPS_DETAIL.id}`);
    await expect(page.getByRole("heading", { name: "PO-2026-E2E8" })).toBeVisible();

    const fileDdsBtn = page.getByRole("button", { name: "File DDS" });
    await expect(fileDdsBtn).toBeDisabled(); // aria-disabled, per Playwright's actionability semantics

    // Real keyboard walk — Tab until the disabled CTA itself has DOM focus,
    // rather than programmatically focusing it, so this proves the same
    // path a keyboard-only user takes.
    let guard = 0;
    while (!(await fileDdsBtn.evaluate((el) => el === document.activeElement)) && guard < 40) {
      await page.keyboard.press("Tab");
      guard += 1;
    }
    await expect(fileDdsBtn).toBeFocused();

    // The blocker tooltip — the same text mouse hover reveals — must also
    // surface on keyboard focus (this was the QA-blocking defect on PR #48).
    await expect(
      page.getByText("2 lots missing harvest period · 3 plots failed deforestation validation")
    ).toBeVisible({ timeout: 10_000 });

    // Enter must not activate the blocked CTA while it's focused.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/sourcing/${GAPS_DETAIL.id}$`));
  });

  /**
   * DELIBERATE UX CHANGE — eudr-frontend#80.
   *
   * "Review plots" used to navigate to `/plots`, which dropped the officer on
   * an unfiltered map with no memory of the lot they came from (the
   * "context-free remediation CTA" class, #84). It now opens the Assign plots
   * sheet in place, targeted at the specific lot carrying the blocker.
   *
   * Pinning the in-place sheet, not the old navigation: leaving the page is
   * the regression here.
   */
  test("'Review plots' opens the Assign plots sheet for the blocking lot, in place (#80)", async ({ page }) => {
    await routeReadinessDetail(page, GAPS_DETAIL);
    await stubLookups(page);
    await page.goto(`/sourcing/${GAPS_DETAIL.id}`);
    await expect(page.getByRole("heading", { name: "PO-2026-E2E8" })).toBeVisible();

    await page.getByRole("button", { name: /Review plots/ }).click();

    await expect(page.getByRole("dialog").getByText("Assign plots")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Pick the land plots that cover this lot/),
    ).toBeVisible();
    // Still on the PO — the whole point of the change.
    await expect(page).toHaveURL(new RegExp(`/sourcing/${GAPS_DETAIL.id}$`));
  });
});

/**
 * eudr-frontend#132. Before this, Fix scrolled to `#lots`, a table with no
 * edit affordance — the officer was told what was wrong and could do nothing
 * about it. This drives MISSING_HARVEST_PERIOD from raised to cleared through
 * the UI: Fix opens the edit-lot Sheet on the blocking lot, Save PATCHes the
 * lot, readiness refetches, and the blocker row is gone without a reload.
 * The backend is stubbed, as every PO-detail journey here is; the serializer
 * already accepts these fields, which is why the issue is frontend-only.
 */
test.describe("PO Detail — a blocker is fixable in place (#132)", () => {
  const LOT_STUB = {
    id: "lot-e2e-1",
    seller_id: READY_DETAIL.seller_id,
    buyer_id: "buyer-e2e",
    product_id: READY_DETAIL.product_id,
    reference_number: "LOT-GH-26-0871",
    quantity: 25000,
    unit: "KG",
    transaction_date: "2026-01-10",
    country_of_harvest: "GH",
    harvest_period_start: null,
    harvest_period_end: null,
    land_plot_ids: ["p1", "p2", "p3"],
    status: "CONFIRMED",
    external_id: "",
    shipment_reference: null,
    expected_clearance_date: null,
    fulfils_reference: null,
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-01-10T00:00:00Z",
  };

  test("Fix opens the edit-lot Sheet; saving a harvest period clears the blocker without a reload", async ({ page }) => {
    // Readiness returns the gap until the lot is saved, then the all-clear.
    let saved = false;
    await page.route("**/api/v1/supply-chain/batches/*/readiness/**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        json: saved
          ? { ...GAPS_DETAIL, blocked: false, blockers: [], lots: [{ ...GAPS_DETAIL.lots[0], harvest_period_start: "2026-03-01", harvest_period_end: "2026-04-30" }] }
          : { ...GAPS_DETAIL, blockers: [GAPS_DETAIL.blockers[0]] },
      });
    });
    let patched: Record<string, unknown> | null = null;
    await page.route(`**/api/v1/supply-chain/batches/${LOT_STUB.id}/`, async (route) => {
      if (route.request().method() === "PATCH") {
        patched = route.request().postDataJSON();
        saved = true;
        await route.fulfill({ json: { ...LOT_STUB, ...patched } });
        return;
      }
      await route.fulfill({ json: LOT_STUB });
    });
    await stubLookups(page);

    await page.goto(`/sourcing/${GAPS_DETAIL.id}`);
    await expect(page.getByRole("heading", { name: "PO-2026-E2E8" })).toBeVisible();
    await expect(page.getByText("2 lots missing harvest period")).toBeVisible();

    await page.getByRole("button", { name: /^Fix$/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: /Edit lot LOT-GH-26-0871/ })).toBeVisible({ timeout: 10_000 });
    // Prefilled from the lot, with the plot hand-off present.
    await expect(sheet.getByLabel(/^Quantity/)).toHaveValue("25000");
    await expect(sheet.getByText(/3 plots assigned/)).toBeVisible();

    await sheet.getByLabel(/Harvest start/).fill("2026-03-01");
    await sheet.getByLabel(/Harvest end/).fill("2026-04-30");
    await sheet.getByRole("button", { name: /^Save$/ }).click();

    // The PATCH carried exactly the editable fields.
    await expect.poll(() => patched).not.toBeNull();
    expect(patched).toMatchObject({ harvest_period_start: "2026-03-01", harvest_period_end: "2026-04-30", unit: "KG" });
    expect(patched).not.toHaveProperty("seller_id");

    // Sheet closed, readiness refetched, blocker gone — no navigation.
    await expect(sheet).toBeHidden();
    await expect(page.getByText("2 lots missing harvest period")).toBeHidden();
    await expect(page.getByText(/ready to file/i)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/sourcing/${GAPS_DETAIL.id}$`));
  });

  test("VIEWER sees the blocker but no Fix and no per-row Edit", async ({ page }) => {
    await routeReadinessDetail(page, { ...GAPS_DETAIL, blockers: [GAPS_DETAIL.blockers[0]] });
    await stubLookups(page);
    await page.route("**/api/v1/accounts/me/", async (route) => {
      await route.fulfill({ json: { id: "u-viewer", email: "viewer@canopy.test", role: "VIEWER", organization_id: "o", organization_name: "Org" } });
    });
    await page.goto(`/sourcing/${GAPS_DETAIL.id}`);
    await expect(page.getByText("2 lots missing harvest period")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Fix$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit$/ })).toHaveCount(0);
  });
});
