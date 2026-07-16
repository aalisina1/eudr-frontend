/**
 * E2E journeys: File DDS composition page (#26, sourcing-readiness.design-
 * prompt.md Prompt C + Round-2 item 1) — the `?po=` deep-link target from
 * PO Detail's "File DDS" CTA (see `e2e/04-supply-chains.spec.ts`'s
 * "Ready to file" test, which asserts the CTA lands on this exact route).
 *
 * The payload-estimate endpoint (eudr-app #94/BE-C, PR #98) is real and
 * merged, but — like the readiness routes in `04-supply-chains.spec.ts` and
 * the TRACES routes in `10-submissions.spec.ts` — all supporting endpoints
 * are stubbed with `page.route` here for deterministic, offline-safe
 * coverage of both the under-limit and (practically unreachable with real
 * seed data) over-limit/split frames. Auth uses the real backend.
 */
import { test, expect } from "@playwright/test";

const PO_ID = "po-e2e-file-dds";
const LOT_1 = "lot-e2e-fd-1";
const LOT_2 = "lot-e2e-fd-2";
const SELLER_ID = "55555555-5555-5555-5555-555555555555";
const PRODUCT_ID = "66666666-6666-6666-6666-666666666666";

const READY_DETAIL = {
  id: PO_ID,
  reference_number: "PO-2026-E2E-FD",
  seller_id: SELLER_ID,
  buyer_id: "22222222-2222-2222-2222-222222222222",
  product_id: PRODUCT_ID,
  transaction_date: "2026-07-01",
  stage: "READY",
  blocked: false,
  blockers: [],
  funnel: {
    unit: "KG",
    ordered_quantity: "50000.0000",
    allocated_quantity: "50000.0000",
    geolocated_quantity: "50000.0000",
    filed_quantity: "0.0000",
    uncovered_quantity: "50000.0000",
  },
  lot_count: 2,
  next_deadline: null,
  lots: [
    {
      id: LOT_1,
      reference_number: "LOT-GH-26-9001",
      quantity: "25000.0000",
      unit: "KG",
      harvest_period_start: "2025-10-01",
      harvest_period_end: "2025-11-01",
      plot_count: 12,
      plots_resolved: true,
      plots_failed_count: 0,
      plots_pending_count: 0,
      filed: false,
      filing_dds_id: null,
      filing_dds_reference: "",
    },
    {
      id: LOT_2,
      reference_number: "LOT-GH-26-9002",
      quantity: "25000.0000",
      unit: "KG",
      harvest_period_start: "2025-09-01",
      harvest_period_end: "2025-12-01",
      plot_count: 8,
      plots_resolved: true,
      plots_failed_count: 0,
      plots_pending_count: 0,
      filed: false,
      filing_dds_id: null,
      filing_dds_reference: "",
    },
  ],
};

const SUPPLIER_STUB = { id: SELLER_ID, name: "Kuapa Kokoo Union", country_of_origin: "GH" };
const PRODUCT_STUB = { id: PRODUCT_ID, commodity_name: "Cocoa", description: "Fermented cocoa beans", cn_code: "1801000000" };

const UNDER_LIMIT_ESTIMATE = {
  estimated_bytes: 18_400_000,
  limit_bytes: 25_000_000,
  exceeds_limit: false,
  batches: [
    { batch_id: LOT_1, shipment_reference: "MV Elbe Trader", plot_count: 12, estimated_bytes: 9_200_000 },
    { batch_id: LOT_2, shipment_reference: "MV Baltic Star", plot_count: 8, estimated_bytes: 9_200_000 },
  ],
  errors: [],
};

const OVER_LIMIT_ESTIMATE = {
  estimated_bytes: 31_200_000,
  limit_bytes: 25_000_000,
  exceeds_limit: true,
  batches: [
    { batch_id: LOT_1, shipment_reference: "MV Elbe Trader", plot_count: 12, estimated_bytes: 14_100_000 },
    { batch_id: LOT_2, shipment_reference: "MV Baltic Star", plot_count: 8, estimated_bytes: 17_100_000 },
  ],
  errors: [],
};

async function stubComposerDependencies(
  page: import("@playwright/test").Page,
  estimate: unknown = UNDER_LIMIT_ESTIMATE,
) {
  await page.route(`**/api/v1/supply-chain/batches/${PO_ID}/readiness/**`, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ json: READY_DETAIL });
  });
  await page.route(`**/api/v1/suppliers/${SELLER_ID}/`, async (route) => route.fulfill({ json: SUPPLIER_STUB }));
  await page.route(`**/api/v1/commodities/products/${PRODUCT_ID}/`, async (route) => route.fulfill({ json: PRODUCT_STUB }));
  await page.route("**/api/v1/supply-chain/batches/payload-estimate/", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({ json: estimate });
  });
}

test.describe("File DDS composer — prefill + declaration summary + payload meter (#26)", () => {
  test("PO Detail's File DDS CTA lands on the pre-filled, full-page composer with every lot checked", async ({ page }) => {
    await stubComposerDependencies(page);
    await page.route(`**/api/v1/supply-chain/batches/${PO_ID}/readiness/**`, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ json: READY_DETAIL });
    });
    await page.goto(`/due-diligence?po=${PO_ID}`);

    await expect(page.getByRole("heading", { name: "New Due Diligence Statement" })).toBeVisible();
    await expect(page.getByText("Pre-filled from PO-2026-E2E-FD")).toBeVisible();

    await expect(page.getByText("LOT-GH-26-9001")).toBeVisible();
    await expect(page.getByText("LOT-GH-26-9002")).toBeVisible();
    await expect(page.getByText("2 of 2 lots selected")).toBeVisible();

    // Declaration summary — auto-summed net mass + harvest range across checked lots.
    await expect(page.getByText("Cocoa")).toBeVisible();
    await expect(page.getByText("50 t")).toBeVisible();
    await expect(page.getByText("Sep – Dec 2025")).toBeVisible();

    // Under-limit payload meter, primary frame.
    await expect(page.getByText("Estimated payload 18.4 MB of 25.0 MB limit")).toBeVisible();

    // Read-only risk placeholder — #25 owns the real UI.
    await expect(page.getByText("Not yet assessed")).toBeVisible();
  });

  test("unchecking a lot recomputes the checked-lot count and net mass", async ({ page }) => {
    await stubComposerDependencies(page);
    await page.goto(`/due-diligence?po=${PO_ID}`);
    await expect(page.getByText("LOT-GH-26-9001")).toBeVisible();
    await expect(page.getByText("50 t")).toBeVisible();

    await page.getByRole("checkbox", { name: "Select LOT-GH-26-9002" }).click();

    await expect(page.getByText("1 of 2 lots selected")).toBeVisible();
    await expect(page.getByText("25 t")).toBeVisible();
  });
});

test.describe("File DDS composer — over-limit payload meter + split-by-shipment (#26)", () => {
  test("shows the destructive frame with the split suggestion, and Split by shipment narrows the selection", async ({ page }) => {
    await stubComposerDependencies(page, OVER_LIMIT_ESTIMATE);
    await page.goto(`/due-diligence?po=${PO_ID}`);

    await expect(page.getByText("31.2 MB — exceeds the TRACES 25.0 MB limit")).toBeVisible();
    await expect(
      page.getByText("Split into 2 statements by shipment: MV Elbe Trader (14.1 MB) · MV Baltic Star (17.1 MB)"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Split by shipment" }).click();
    await expect(page.getByText("1 of 2 lots selected")).toBeVisible();
  });
});

test.describe("File DDS composer — 72h lock dialog + submit hand-off (#26)", () => {
  test("Submit to TRACES opens the 72h-lock AlertDialog; confirming creates the DDS, submits it for review, and hands off to its detail page", async ({ page }) => {
    await stubComposerDependencies(page);

    const NEW_DDS_ID = "dds-e2e-file-dds-1";
    let createBody: unknown = null;
    await page.route("**/api/v1/due-diligence/statements/", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      createBody = route.request().postDataJSON();
      await route.fulfill({ json: { id: NEW_DDS_ID, reference_number: "DDS-E2E-1", status: "DRAFT" } });
    });
    await page.route(`**/api/v1/due-diligence/statements/${NEW_DDS_ID}/submit-for-review/`, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({ json: { id: NEW_DDS_ID, reference_number: "DDS-E2E-1", status: "UNDER_REVIEW" } });
    });
    // The DDS detail page this hands off to fetches the statement itself.
    await page.route(`**/api/v1/due-diligence/statements/${NEW_DDS_ID}/`, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        json: {
          id: NEW_DDS_ID,
          reference_number: "DDS-E2E-1",
          traces_reference: "",
          status: "UNDER_REVIEW",
          statement_type: "OPERATOR",
          activity_type: "",
          batch_ids: [LOT_1, LOT_2],
          risk_conclusion: null,
          conclusion_justification: "",
          created_by_id: "u1",
          reviewed_by_id: null,
          submitted_at: null,
          valid_until: null,
          archived_until: null,
          risk_assessments: [],
          created_at: "2026-07-15T00:00:00Z",
          updated_at: "2026-07-15T00:00:00Z",
        },
      });
    });
    await page.route("**/api/v1/traces/submissions/**", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
    });

    await page.goto(`/due-diligence?po=${PO_ID}`);
    await expect(page.getByText("LOT-GH-26-9001")).toBeVisible();

    await page.getByRole("button", { name: /Submit to TRACES/ }).click();

    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByText("Submit to TRACES?")).toBeVisible();
    await expect(page.getByText(/locks — you have 72 hours to amend it/)).toBeVisible();

    await page.getByRole("button", { name: "Submit statement" }).click();

    await expect(page).toHaveURL(new RegExp(`/due-diligence/${NEW_DDS_ID}$`));
    expect((createBody as { batch_ids: string[] })?.batch_ids?.sort()).toEqual([LOT_1, LOT_2].sort());
  });
});
