/**
 * E2E journeys: Shipments cockpit (`/shipments`, `/shipments/[id]`) + the
 * port-location map (ADR-0025) — eudr-vault/10-Specs/UI-Workflows/shipments.md.
 *
 * Stub-vs-live choice (documented per test group below, house convention from
 * `10-submissions.spec.ts` / `04-supply-chains.spec.ts`):
 *   - REAL backend: auth/nav/role-gating, and everything the live seeded data
 *     on maria's org (COMPLIANCE_OFFICER) can exercise deterministically —
 *     RAG filter, date-range filter (both server-side per eudr-app #121), the
 *     RED detail + blocker deep-link, Compose-DDS prefill, the location map
 *     (3 seeded consignments carry a real `latest_location`), and the
 *     zero-results state (RAG=GRAY has 0 live matches).
 *   - STUBBED (`page.route`, registered before `page.goto`): every state the
 *     live 5-consignment fixture can't produce — empty (zero consignments),
 *     GRAY (no date at all), the divergence badge (no live row has both a
 *     manual date and a feed ETA), tracking states `live`/`error`/
 *     `quota_reached` (only `untracked`/`subscribing` are derivable from live
 *     data), 404, and the "GREEN after filing" recompute (the DDS filing
 *     mechanics themselves are already covered by `05-due-diligence.spec.ts`
 *     / `11-file-dds-composer.spec.ts`; this locks in that the *shipments*
 *     detail page re-renders the new RAG/coverage on a fresh fetch, not that
 *     it caches stale data). The manual "Assign to consignment" journey is
 *     fully stubbed (readiness detail + consignments POSTs) because no
 *     seeded PO has a lot with `shipment_reference: null` today, and per
 *     house convention (`02-suppliers.spec.ts` "create affordance opens a
 *     form" et al.) this suite never performs a real mutating POST/PATCH
 *     against the shared live dataset — only reads.
 *
 * Consignment ids are looked up by reference via the UI's own search box
 * (`openConsignmentByReference`) rather than hardcoded: consignment PKs are
 * random UUID4s (not deterministic like the batch/lot uuid5 ids), so they
 * differ across `seed_demo_data` runs.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { CREDENTIALS, expectListResponded, login } from "./helpers";

// ---------------------------------------------------------------------------
// Live seeded fixtures (maria's org, COMPLIANCE_OFFICER) — see task brief.
// ---------------------------------------------------------------------------
const REF = {
  green: "HLCU-990041", // GREEN, 1/1 covered, no location, untracked
  red: "MSCU-884210", // RED, 0/2, no location, untracked, 2 ALLOCATED lots
  amberAntwerp: "MAEU-778812", // AMBER, location Antwerp (BEANR), subscribing
  amberTema: "MSCU-338820", // AMBER, location Tema (GHTEM), subscribing
  amberRotterdam: "BKG-2026-4471", // AMBER, location Rotterdam (NLRTM), subscribing, 1 lot
} as const;

/** Search `/shipments` for an exact reference (server-side search, #121) and
 * open the single matching row. Returns the resolved consignment id. */
async function openConsignmentByReference(page: Page, reference: string): Promise<string> {
  await page.goto("/shipments");
  await expectListResponded(page);
  await page.getByPlaceholder(/Search reference or tracking/).fill(reference);
  const row = page.locator("tr.cursor-pointer", { hasText: reference });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await row.click();
  await page.waitForURL(/\/shipments\/[^/?]+$/);
  return page.url().split("/shipments/")[1]!.split(/[?#]/)[0]!;
}

/** Route the plain LIST endpoint only (never a per-id detail fetch), matching
 * on pathname so query params don't defeat the glob. */
function routeConsignmentsList(page: Page, body: unknown) {
  return page.route("**/api/v1/supply-chain/consignments/**", async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() !== "GET" || path !== "/api/v1/supply-chain/consignments/") return route.fallback();
    await route.fulfill({ json: body });
  });
}

/** Route a specific fake consignment's detail endpoint. `sequence` lets a
 * test return a different payload per successive GET (stateful stub, same
 * pattern as `10-submissions.spec.ts`'s `routeSubmissions`); the last entry
 * repeats once exhausted. A single status (e.g. 404) can be passed instead. */
function routeConsignmentDetail(
  page: Page,
  id: string,
  sequence: unknown[] | { status: number },
) {
  let call = 0;
  return page.route(`**/api/v1/supply-chain/consignments/${id}/**`, async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    if (!Array.isArray(sequence)) {
      await route.fulfill({ status: sequence.status, json: { detail: "Not found." } });
      return;
    }
    const body = sequence[Math.min(call, sequence.length - 1)];
    call += 1;
    await route.fulfill({ json: body });
  });
}

function baseConsignment(overrides: Record<string, unknown>) {
  return {
    id: "e2e-fixture",
    reference: "E2E-FIXTURE",
    expected_clearance_date: null,
    tracking_number: null,
    t49_request_id: null,
    latest_eta: null,
    eta_source: "NONE",
    created_at: "2026-01-01T00:00:00Z",
    rag: "GRAY",
    covered_count: 0,
    total_count: 0,
    countdown_to: null,
    tracking_state: "untracked",
    latest_location: null,
    latest_event_type: null,
    latest_event_at: null,
    po_count: null,
    ...overrides,
  };
}

function baseDetail(overrides: Record<string, unknown>) {
  return { ...baseConsignment({}), lots: [], events: [], ...overrides };
}

// ===========================================================================
// COMPLIANCE_OFFICER — core triage → resolve → file journey (live backend)
// ===========================================================================
test.describe("COMPLIANCE_OFFICER — dashboard entry + list filters (criteria 1-2, live)", () => {
  test("dashboard lead-time card click lands on /shipments pre-filtered to RED", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Shipment lead time")).toBeVisible({ timeout: 15_000 });

    const link = page.getByRole("link", { name: /within 10 days with incomplete DDS/ });
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();

    await expect(page).toHaveURL(/\/shipments\?rag=RED/);
    await expect(page.getByLabel("RAG status")).toHaveValue("RED");

    const rows = await expectListResponded(page);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(REF.red);
    // GREEN/AMBER rows must NOT appear under the RED prefilter.
    await expect(page.getByText(REF.green)).toHaveCount(0);
  });

  test("RAG filter narrows the list to exactly the selected value (server-side, #121)", async ({ page }) => {
    await page.goto("/shipments");
    await expectListResponded(page);

    let nextRequest = page.waitForRequest((req) => req.url().includes("rag=RED"));
    await page.getByLabel("RAG status").selectOption("RED");
    await nextRequest;
    let rows = await expectListResponded(page);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(REF.red);

    // RAG=GRAY has zero live matches — doubles as the "zero results after
    // filter" state assertion (States table).
    nextRequest = page.waitForRequest((req) => req.url().includes("rag=GRAY"));
    await page.getByLabel("RAG status").selectOption("GRAY");
    await nextRequest;
    await expect(page.getByText("No shipments match these filters")).toBeVisible({ timeout: 10_000 });
    const clearBtn = page.getByRole("button", { name: "Clear filters" });
    await expect(clearBtn).toBeVisible();

    // Clearing reverts to the exact same query string as the initial
    // unfiltered load, which React Query may legitimately serve from cache
    // (staleTime 60s) without a new network round-trip — assert the
    // resulting UI state instead of a fresh request.
    await clearBtn.click();
    await expect(page.getByLabel("RAG status")).toHaveValue("");
    rows = await expectListResponded(page);
    await expect(await rows.count()).toBeGreaterThan(1);
  });

  test("date-range filter narrows to consignments whose countdown_to falls in range (server-side)", async ({ page }) => {
    await page.goto("/shipments");
    await expectListResponded(page);

    const nextRequest = page.waitForRequest(
      (req) => req.url().includes("countdown_after=2026-09-01") && req.url().includes("countdown_before=2026-09-30"),
    );
    await page.getByLabel("Lands after").fill("2026-09-01");
    await page.getByLabel("Lands before").fill("2026-09-30");
    await nextRequest;

    const rows = await expectListResponded(page);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(REF.amberRotterdam);
  });
});

test.describe("COMPLIANCE_OFFICER — RED detail, blocker deep-link, Compose DDS (criteria 3-4, live)", () => {
  test("RED consignment detail shows coverage, countdown, and an uncovered lot with a stage chip + blocker deep-link", async ({ page }) => {
    await openConsignmentByReference(page, REF.red);

    await expect(page.getByRole("heading", { name: REF.red })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: /^RED/ })).toBeVisible();
    await expect(page.getByText(/Coverage\s*0\/2\s*·\s*0%/)).toBeVisible();

    // Uncovered lot, ALLOCATED stage chip, and its blocker deep-link.
    await expect(page.locator('[data-slot="badge"]', { hasText: "Allocated" }).first()).toBeVisible();
    const fixIt = page.getByRole("link", { name: "Complete plots" }).first();
    await expect(fixIt).toBeVisible();
    await fixIt.click();
    await expect(page).toHaveURL(/\/plots$/);
  });

  test("Compose DDS from consignment detail lands on the DDS composer pre-filled with its lots", async ({ page }) => {
    const id = await openConsignmentByReference(page, REF.amberRotterdam);

    const composeBtn = page.getByRole("button", { name: "Compose DDS" });
    await expect(composeBtn).toBeEnabled();
    await composeBtn.click();

    await expect(page).toHaveURL(new RegExp(`/due-diligence\\?consignment=${id}`));
    await expect(page.getByRole("heading", { name: "New Due Diligence Statement" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Pre-filled from ${REF.amberRotterdam}`)).toBeVisible();
  });
});

test.describe("COMPLIANCE_OFFICER — GREEN after filing recomputes (criterion 5, stubbed)", () => {
  test("returning to /shipments/[id] after coverage completes shows RAG=GREEN and 100%", async ({ page }) => {
    const id = "e2e-green-recompute-1";
    routeConsignmentDetail(page, id, [
      baseDetail({
        id, reference: "E2E-RECOMPUTE-1", rag: "RED", covered_count: 0, total_count: 1,
        expected_clearance_date: "2026-08-01", countdown_to: "2026-08-01",
        lots: [{ id: "lot-1", reference_number: "LOT-1", quantity: "10.0000", unit: "KG", stage: "READY", covered: false, covering_dds_id: null, covering_dds_reference: "" }],
      }),
      baseDetail({
        id, reference: "E2E-RECOMPUTE-1", rag: "GREEN", covered_count: 1, total_count: 1,
        expected_clearance_date: "2026-08-01", countdown_to: "2026-08-01",
        lots: [{ id: "lot-1", reference_number: "LOT-1", quantity: "10.0000", unit: "KG", stage: "FILED", covered: true, covering_dds_id: "dds-1", covering_dds_reference: "DDS-2026-E2E" }],
      }),
    ]);

    await page.goto(`/shipments/${id}`);
    await expect(page.locator('[data-slot="badge"]', { hasText: /^RED/ })).toBeVisible();
    await expect(page.getByText(/Coverage\s*0\/1\s*·\s*0%/)).toBeVisible();

    // Simulate "returning after filing" with a full navigation (a fresh
    // document load, unaffected by React Query's 60s staleTime) — the DDS
    // filing round-trip itself is exercised by 05-due-diligence.spec.ts /
    // 11-file-dds-composer.spec.ts; this isolates the shipments detail
    // page's own recompute-on-fresh-fetch contract.
    await page.goto(`/shipments/${id}`);
    await expect(page.locator('[data-slot="badge"]', { hasText: "Covered" })).toBeVisible();
    await expect(page.getByText(/Coverage\s*1\/1\s*·\s*100%/)).toBeVisible();
  });
});

// ===========================================================================
// COMPLIANCE_OFFICER / ADMIN — manual shipment management (criterion 6, stubbed)
// ===========================================================================
const PO_WITH_UNASSIGNED = {
  id: "po-e2e-unassigned",
  reference_number: "PO-2026-E2E-UNASSIGNED",
  seller_id: "sup-e2e-unassigned",
  buyer_id: "buyer-e2e-unassigned",
  product_id: "prod-e2e-unassigned",
  transaction_date: "2026-07-01",
  stage: "ALLOCATED",
  blocked: false,
  blockers: [],
  funnel: {
    unit: "KG", ordered_quantity: "10000.0000", allocated_quantity: "10000.0000",
    geolocated_quantity: "0.0000", filed_quantity: "0.0000", uncovered_quantity: "10000.0000",
  },
  lot_count: 2,
  next_deadline: null,
  lots: [
    {
      id: "lot-e2e-assigned", reference_number: "LOT-E2E-A", quantity: "5000.0000", unit: "KG",
      harvest_period_start: "2025-10-01", harvest_period_end: "2025-12-01", shipment_reference: "MSCU-884210",
      plot_count: 5, plots_resolved: true, plots_failed_count: 0, plots_pending_count: 0,
      filed: false, filing_dds_id: null, filing_dds_reference: "",
    },
    {
      id: "lot-e2e-unassigned", reference_number: "LOT-E2E-U", quantity: "5000.0000", unit: "KG",
      harvest_period_start: "2025-10-01", harvest_period_end: "2025-12-01", shipment_reference: null,
      plot_count: 5, plots_resolved: true, plots_failed_count: 0, plots_pending_count: 0,
      filed: false, filing_dds_id: null, filing_dds_reference: "",
    },
  ],
};

async function stubUnassignedPoDetail(page: Page) {
  await page.route("**/api/v1/supply-chain/batches/*/readiness/**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ json: PO_WITH_UNASSIGNED });
  });
  await page.route(`**/api/v1/suppliers/${PO_WITH_UNASSIGNED.seller_id}/`, async (route) => {
    await route.fulfill({ json: { id: PO_WITH_UNASSIGNED.seller_id, name: "E2E Supplier", country_of_origin: "GH" } });
  });
  await page.route(`**/api/v1/commodities/products/${PO_WITH_UNASSIGNED.product_id}/`, async (route) => {
    await route.fulfill({ json: { id: PO_WITH_UNASSIGNED.product_id, commodity_name: "Cocoa", description: "Beans" } });
  });
}

test.describe("COMPLIANCE_OFFICER — manual Assign to consignment from PO unassigned bucket (criterion 6, stubbed)", () => {
  test("attaches the unassigned lot to a newly created consignment", async ({ page }) => {
    await stubUnassignedPoDetail(page);

    let createBody: unknown;
    let assignBody: unknown;
    await page.route("**/api/v1/supply-chain/consignments/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "GET") {
        await route.fulfill({ json: { count: 0, next: null, previous: null, total_pages: 0, results: [] } });
        return;
      }
      if (req.method() === "POST" && url.pathname.endsWith("/lots/")) {
        assignBody = req.postDataJSON();
        await route.fulfill({ json: { added: assignBody } });
        return;
      }
      if (req.method() === "POST") {
        createBody = req.postDataJSON();
        await route.fulfill({ json: { id: "consignment-e2e-new", reference: "BL-E2E-NEW" } });
        return;
      }
      return route.fallback();
    });

    await page.goto(`/supply-chains/${PO_WITH_UNASSIGNED.id}`);
    await expect(page.getByRole("heading", { name: PO_WITH_UNASSIGNED.reference_number })).toBeVisible();
    await expect(page.getByText("No shipment assigned")).toBeVisible();

    // Interaction 1: open the Sheet from the unassigned bucket's CTA.
    await page.getByRole("button", { name: "Assign to consignment" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Assign to consignment" })).toBeVisible();
    await expect(dialog.getByText("Attach 1 lot")).toBeVisible();

    // Interaction 2: create-and-assign inline.
    await dialog.getByRole("button", { name: "New", exact: true }).click();
    await dialog.getByLabel(/Reference/).fill("BL-E2E-NEW");
    await dialog.getByRole("button", { name: "Assign" }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    expect((createBody as { reference: string }).reference).toBe("BL-E2E-NEW");
    expect((assignBody as { add: string[] }).add).toEqual(["lot-e2e-unassigned"]);
  });
});

// ===========================================================================
// States matrix — empty / GRAY / divergence / tracking states / held-at / 404
// ===========================================================================
test.describe("States matrix (stubbed, no live fixture produces these)", () => {
  test("empty state (no consignments at all) shows the first-run CTAs", async ({ page }) => {
    routeConsignmentsList(page, { count: 0, next: null, previous: null, total_pages: 0, results: [] });
    await page.goto("/shipments");

    await expect(page.getByText("No shipments tracked yet")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "New consignment" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Assign lots to a consignment" })).toBeVisible();
  });

  test("list renders GRAY/RED tracking-state badges and the Held-at column correctly", async ({ page }) => {
    const rows = [
      baseConsignment({ id: "c-gray", reference: "E2E-GRAY-1", rag: "GRAY", total_count: 2 }),
      baseConsignment({
        id: "c-live", reference: "E2E-LIVE-1", rag: "AMBER", tracking_state: "live", countdown_to: "2026-08-01",
        latest_location: { locode: "SGSIN", name: "Singapore", latitude: 1.29, longitude: 103.85, event_type: "vessel_departed", occurred_at: "2026-07-20T00:00:00Z" },
      }),
      baseConsignment({ id: "c-error", reference: "E2E-ERROR-1", rag: "RED", tracking_state: "error", countdown_to: "2026-07-25" }),
      baseConsignment({ id: "c-quota", reference: "E2E-QUOTA-1", rag: "GREEN", tracking_state: "quota_reached", covered_count: 1, total_count: 1 }),
    ];
    routeConsignmentsList(page, { count: rows.length, next: null, previous: null, total_pages: 1, results: rows });
    await page.goto("/shipments");
    await expectListResponded(page);

    await expect(page.locator('[data-slot="badge"]', { hasText: "No date" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "Live" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "Tracking error" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]', { hasText: "Quota reached" })).toBeVisible();

    const liveRow = page.locator("tr", { hasText: "E2E-LIVE-1" });
    await expect(liveRow.locator("td").last()).toHaveText("Singapore");
    const grayRow = page.locator("tr", { hasText: "E2E-GRAY-1" });
    await expect(grayRow.locator("td").last()).toHaveText("—");
  });

  test("GRAY detail (no clearance date or ETA at all)", async ({ page }) => {
    const id = "e2e-gray-detail-1";
    routeConsignmentDetail(page, id, [
      baseDetail({ id, reference: "E2E-GRAY-DETAIL-1", rag: "GRAY", total_count: 1, lots: [{ id: "l1", reference_number: "LOT-1", quantity: "1.0000", unit: "KG", stage: "OPEN", covered: false, covering_dds_id: null, covering_dds_reference: "" }] }),
    ]);
    await page.goto(`/shipments/${id}`);

    await expect(page.locator('[data-slot="badge"]', { hasText: "No date" })).toBeVisible();
    await expect(page.getByText("No clearance date or ETA set — set one via Edit.")).toBeVisible();
  });

  test("divergence badge: destructive when the manual date is later than the feed ETA, muted otherwise", async ({ page }) => {
    const laterId = "e2e-divergence-later";
    routeConsignmentDetail(page, laterId, [
      baseDetail({
        id: laterId, reference: "E2E-DIVERGENCE-LATER", rag: "AMBER", tracking_state: "live",
        expected_clearance_date: "2026-08-20", latest_eta: "2026-08-10", countdown_to: "2026-08-20",
      }),
    ]);
    await page.goto(`/shipments/${laterId}`);
    const laterBadge = page.getByText("Date ≠ ETA");
    await expect(laterBadge).toBeVisible();
    // Scope to the DivergenceBadge's OWN conditional classes, not the shared
    // Badge base style (which always carries `aria-invalid:border-destructive`
    // utility classes regardless of tone).
    await expect(laterBadge).toHaveClass(/border-destructive\/40/);
    await expect(laterBadge).toHaveAttribute("title", /Manual date differs from live ETA/);

    const earlierId = "e2e-divergence-earlier";
    routeConsignmentDetail(page, earlierId, [
      baseDetail({
        id: earlierId, reference: "E2E-DIVERGENCE-EARLIER", rag: "AMBER", tracking_state: "live",
        expected_clearance_date: "2026-08-01", latest_eta: "2026-08-10", countdown_to: "2026-08-01",
      }),
    ]);
    await page.goto(`/shipments/${earlierId}`);
    const earlierBadge = page.getByText("Date ≠ ETA");
    await expect(earlierBadge).toBeVisible();
    await expect(earlierBadge).not.toHaveClass(/border-destructive\/40/);
    await expect(earlierBadge).toHaveClass(/border-border\b/);
  });

  test("cross-org / nonexistent detail renders the standard house 404, never a 403 or leaked row", async ({ page }) => {
    // Stubbed 404 — matches Decision 7 (cross-org access is 404, verified
    // live against the real backend too: a SUPPLIER_CONTACT's org token
    // hitting maria's real consignment id returns 404, confirmed manually).
    const id = "e2e-404-stub";
    routeConsignmentDetail(page, id, { status: 404 });
    await page.goto(`/shipments/${id}`);
    await expect(page.getByText("Consignment not found or failed to load.")).toBeVisible({ timeout: 10_000 });

    // Live, unstubbed: a genuinely nonexistent id against the real backend.
    await page.goto("/shipments/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Consignment not found or failed to load.")).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// Map (ADR-0025) — located vs. no-location, live seeded data
// ===========================================================================
test.describe("Port-location map (ADR-0025, live)", () => {
  test("a located consignment renders the map container + 'Currently at <port>' readout", async ({ page }) => {
    await openConsignmentByReference(page, REF.amberRotterdam);
    await expect(page.getByText("Location", { exact: true })).toBeVisible();
    await expect(page.locator(".h-56.w-full.overflow-hidden.rounded-xl")).toBeVisible();
    await expect(page.getByText("Currently at Rotterdam")).toBeVisible();
  });

  test("a consignment with no location shows the 'No location yet' fallback", async ({ page }) => {
    await openConsignmentByReference(page, REF.red);
    await expect(page.getByText("No location yet")).toBeVisible();
    await expect(page.getByText("Set a tracking number to follow this shipment.")).toBeVisible();
    await expect(page.locator(".h-56.w-full.overflow-hidden.rounded-xl")).toHaveCount(0);
  });

  test("list 'Held at' column shows the port name for located rows and '—' otherwise", async ({ page }) => {
    await page.goto("/shipments");
    await expectListResponded(page);

    const rotterdamRow = page.locator("tr.cursor-pointer", { hasText: REF.amberRotterdam });
    await expect(rotterdamRow.locator("td").last()).toHaveText("Rotterdam");
    const antwerpRow = page.locator("tr.cursor-pointer", { hasText: REF.amberAntwerp });
    await expect(antwerpRow.locator("td").last()).toHaveText("Antwerp");
    const temaRow = page.locator("tr.cursor-pointer", { hasText: REF.amberTema });
    await expect(temaRow.locator("td").last()).toHaveText("Tema");
    const redRow = page.locator("tr.cursor-pointer", { hasText: REF.red });
    await expect(redRow.locator("td").last()).toHaveText("—");
  });
});

// ===========================================================================
// Dark mode — RAG/tracking badges unaffected
// ===========================================================================
test.describe("Dark mode (criterion, live)", () => {
  test("toggling dark mode keeps RAG and tracking badges visible and unstyled-broken", async ({ page }) => {
    await openConsignmentByReference(page, REF.red);
    const ragBadge = page.locator('[data-slot="badge"]', { hasText: /^RED/ });
    const trackingBadge = page.locator('[data-slot="badge"]', { hasText: "Not tracked" });
    await expect(ragBadge).toBeVisible();
    await expect(trackingBadge).toBeVisible();

    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(ragBadge).toBeVisible();
    await expect(trackingBadge).toBeVisible();
  });
});

// ===========================================================================
// ADMIN — edit a consignment, reflected without a full reload (criterion 7, stubbed)
// ===========================================================================
test.describe("ADMIN — edit consignment reflected in detail + list (stubbed)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("PATCH via the Edit sheet updates the detail header and the list row", async ({ page }) => {
    await login(page, CREDENTIALS.admin);
    const id = "e2e-admin-edit-1";

    const ORIGINAL = baseDetail({
      id, reference: "E2E-ADMIN-1", rag: "AMBER", total_count: 1,
      expected_clearance_date: "2026-08-01", countdown_to: "2026-08-01",
    });
    const UPDATED = baseDetail({
      id, reference: "E2E-ADMIN-1-EDITED", rag: "AMBER", total_count: 1, tracking_number: "TRK-NEW-99",
      expected_clearance_date: "2026-09-15", countdown_to: "2026-09-15",
    });

    let patchBody: unknown;
    let detailCall = 0;
    await page.route(`**/api/v1/supply-chain/consignments/${id}/`, async (route) => {
      const req = route.request();
      if (req.method() === "PATCH") {
        patchBody = req.postDataJSON();
        await route.fulfill({ json: { id, reference: "E2E-ADMIN-1-EDITED", tracking_number: "TRK-NEW-99", expected_clearance_date: "2026-09-15" } });
        return;
      }
      if (req.method() !== "GET") return route.fallback();
      const body = detailCall === 0 ? ORIGINAL : UPDATED;
      detailCall += 1;
      await route.fulfill({ json: body });
    });
    await routeConsignmentsList(page, {
      count: 1, next: null, previous: null, total_pages: 1,
      results: [baseConsignment({ id, reference: "E2E-ADMIN-1-EDITED", rag: "AMBER", tracking_number: "TRK-NEW-99", expected_clearance_date: "2026-09-15", countdown_to: "2026-09-15" })],
    });

    await page.goto(`/shipments/${id}`);
    await expect(page.getByRole("heading", { name: "E2E-ADMIN-1" })).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit consignment" })).toBeVisible();
    await dialog.getByLabel(/Reference/).fill("E2E-ADMIN-1-EDITED");
    await dialog.getByLabel(/Expected clearance date/).fill("2026-09-15");
    await dialog.getByLabel(/Tracking number/).fill("TRK-NEW-99");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    expect(patchBody).toMatchObject({ reference: "E2E-ADMIN-1-EDITED", expected_clearance_date: "2026-09-15", tracking_number: "TRK-NEW-99" });
    // Detail reflects the edit via the standard React Query invalidation
    // refetch — no full page reload.
    await expect(page.getByRole("heading", { name: "E2E-ADMIN-1-EDITED" })).toBeVisible({ timeout: 10_000 });

    // List reflects it too (its own query key was invalidated on save).
    await page.getByRole("button", { name: "All shipments" }).click();
    await expect(page).toHaveURL(/\/shipments$/);
    await expect(page.getByText("E2E-ADMIN-1-EDITED")).toBeVisible({ timeout: 10_000 });
  });
});

// ===========================================================================
// VIEWER — every mutation control absent from the DOM (criterion 8)
// ===========================================================================
test.describe("VIEWER — mutation controls absent (mix live + stubbed)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/shipments: New consignment is absent", async ({ page }) => {
    await login(page, CREDENTIALS.viewer);
    await page.goto("/shipments");
    await expectListResponded(page);
    await expect(page.getByRole("button", { name: "New consignment" })).toHaveCount(0);
  });

  test("/shipments/[id]: Edit, Assign lots, Compose DDS, and the tracking-# CTA are absent", async ({ page }) => {
    await login(page, CREDENTIALS.viewer);
    await openConsignmentByReference(page, REF.red);

    await expect(page.getByRole("heading", { name: REF.red })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Assign lots" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Compose DDS" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Set tracking #" })).toHaveCount(0);
    // Read-only content is still fully visible.
    await expect(page.locator('[data-slot="badge"]', { hasText: /^RED/ })).toBeVisible();
  });

  test("PO detail's unassigned-lots bucket: 'Assign to consignment' CTA is absent", async ({ page }) => {
    await login(page, CREDENTIALS.viewer);
    await stubUnassignedPoDetail(page);
    await page.goto(`/supply-chains/${PO_WITH_UNASSIGNED.id}`);

    await expect(page.getByRole("heading", { name: PO_WITH_UNASSIGNED.reference_number })).toBeVisible();
    await expect(page.getByText("No shipment assigned")).toBeVisible();
    await expect(page.getByRole("button", { name: "Assign to consignment" })).toHaveCount(0);
  });
});

// ===========================================================================
// SUPPLIER_CONTACT — no route access at all (criterion 9, live)
// ===========================================================================
test.describe("SUPPLIER_CONTACT — route-level block (live)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/shipments never reaches the shipments UI", async ({ page }) => {
    await login(page, CREDENTIALS.supplier);
    await page.goto("/shipments");
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Shipments" })).toHaveCount(0);
  });

  test("/shipments/[id] never reaches the shipments UI", async ({ page }) => {
    await login(page, CREDENTIALS.supplier);
    await page.goto("/shipments/any-id-at-all");
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.getByText("Compose DDS")).toHaveCount(0);
  });
});
