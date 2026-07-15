/**
 * Dashboard-as-worklist (#30, Prompt D) — replaces the old chart dashboard.
 * Live seeded data is sparse until #84 seeds richer readiness/TRACES-reject
 * fixtures, so the "busy" (something in every card) state is stubbed with
 * `page.route`, following the same pattern `10-submissions.spec.ts` uses for
 * TRACES: stubs registered BEFORE navigation, real backend for auth/nav.
 * The "all clear" state is also stubbed explicitly so the quiet empty-state
 * lines (and the absence of any chart) are locked in regardless of what's
 * actually seeded right now.
 */
import { test, expect, type Page } from "@playwright/test";

function readinessRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "po-e2e-1",
    reference_number: "PO-2026-0141",
    seller_id: "sup-e2e-1",
    buyer_id: "buyer-e2e-1",
    commodity_id: "commodity-e2e-1",
    transaction_date: "2026-07-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "500000.0000",
      allocated_quantity: "500000.0000",
      geolocated_quantity: "500000.0000",
      filed_quantity: "250000.0000",
      uncovered_quantity: "250000.0000",
    },
    lot_count: 2,
    next_deadline: "2026-07-20",
    ...overrides,
  };
}

const BLOCKED_PO = readinessRow({
  id: "po-e2e-2",
  reference_number: "PO-2026-0138",
  stage: "ALLOCATED",
  blocked: true,
  blockers: [{ code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 }],
  next_deadline: null,
});

const OPEN_PO = readinessRow({
  id: "po-e2e-3",
  reference_number: "PO-2026-0156",
  stage: "OPEN",
  blockers: [{ code: "NO_LOTS_LINKED", message: "No lots linked yet", count: null }],
  lot_count: 0,
  next_deadline: null,
});

// PLOTS_COMPLETE, non-blocked — QA finding on PR #46: this stage was
// silently excluded from every card despite the readiness endpoint
// returning an actionable `blockers` message for it (mirrors the live
// seeded PO-2026-0212 repro: 240t geolocated, "1 lot missing harvest
// period", a real deadline). Must land in "Awaiting data".
const PLOTS_COMPLETE_PO = readinessRow({
  id: "po-e2e-4",
  reference_number: "PO-2026-0212",
  stage: "PLOTS_COMPLETE",
  blockers: [{ code: "MISSING_HARVEST_PERIOD", message: "1 lot missing harvest period", count: 1 }],
  funnel: {
    unit: "TONNES",
    ordered_quantity: "240.0000",
    allocated_quantity: "240.0000",
    geolocated_quantity: "240.0000",
    filed_quantity: "0.0000",
    uncovered_quantity: "240.0000",
  },
  lot_count: 3,
  next_deadline: "2026-08-20",
});

const DDS_STATEMENT = {
  id: "dds-e2e-1",
  reference_number: "DDS-2026-0089",
  traces_reference: "",
  status: "SUBMITTED",
  statement_type: "OPERATOR",
  activity_type: "IMPORT",
  batch_ids: [],
  risk_conclusion: null,
  conclusion_justification: "",
  operator_id: "op-1",
  created_by_id: "u1",
  reviewed_by_id: null,
  submitted_at: new Date().toISOString(),
  valid_until: null,
  archived_until: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function summary(overrides: Record<string, unknown> = {}) {
  return {
    po_count: 9,
    stage_counts: { OPEN: 1, ALLOCATED: 1, PLOTS_COMPLETE: 5, READY: 1, FILED: 1 },
    blocked_count: 1,
    funnel: {
      unit: "KG",
      ordered_quantity: "5000000.0000",
      allocated_quantity: "3000000.0000",
      geolocated_quantity: "2500000.0000",
      filed_quantity: "3760000.0000",
      uncovered_quantity: "1240000.0000",
    },
    ...overrides,
  };
}

/** Stubs every endpoint the worklist reads, BEFORE navigation. */
async function stubWorklist(
  page: Page,
  opts: {
    readinessResults: unknown[];
    summaryBody: unknown;
    ddsResults: unknown[];
    latestSubmissions?: { id: string; dds_id: string; status: string }[];
    submissionDetail?: unknown;
    plotsPendingCount?: number;
  }
) {
  await page.route("**/api/v1/supply-chain/batches/readiness/summary/**", async (route) => {
    await route.fulfill({ json: opts.summaryBody });
  });
  await page.route("**/api/v1/supply-chain/batches/readiness/**", async (route) => {
    if (route.request().url().includes("/summary/")) return route.fallback();
    await route.fulfill({
      json: { count: opts.readinessResults.length, next: null, previous: null, results: opts.readinessResults },
    });
  });
  await page.route("**/api/v1/suppliers/**", async (route) => {
    await route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } });
  });
  await page.route("**/api/v1/due-diligence/statements/**", async (route) => {
    await route.fulfill({
      json: { count: opts.ddsResults.length, next: null, previous: null, results: opts.ddsResults },
    });
  });
  await page.route("**/api/v1/traces/submissions/**", async (route) => {
    const url = route.request().url();
    const isDetail = /\/traces\/submissions\/[^/?]+\/?($|\?)/.test(url) && !url.endsWith("/submissions/");
    if (isDetail) {
      await route.fulfill({ json: opts.submissionDetail ?? {} });
      return;
    }
    await route.fulfill({
      json: {
        count: (opts.latestSubmissions ?? []).length,
        next: null,
        previous: null,
        results: opts.latestSubmissions ?? [],
      },
    });
  });
  await page.route("**/api/v1/geolocation/plots/**", async (route) => {
    await route.fulfill({ json: { count: opts.plotsPendingCount ?? 0, next: null, previous: null, results: [] } });
  });
}

test.describe("Dashboard worklist (#30)", () => {
  test("loads with a greeting header and no chart elements", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Needs filing")).toBeVisible();
    await expect(page.getByText("Needs remediation")).toBeVisible();
    await expect(page.getByText("Awaiting data")).toBeVisible();
    // No donut/bar charts anywhere on the page (the old dashboard).
    await expect(page.getByText("Due Diligence by Status")).toHaveCount(0);
    await expect(page.getByText("Welcome to Canopy")).toHaveCount(0);
  });

  test("busy state — populates all three cards and the stat strip", async ({ page }) => {
    await stubWorklist(page, {
      readinessResults: [readinessRow(), BLOCKED_PO, OPEN_PO, PLOTS_COMPLETE_PO],
      summaryBody: summary(),
      ddsResults: [DDS_STATEMENT],
      latestSubmissions: [{ id: "sub-e2e-1", dds_id: "dds-e2e-1", status: "SUBMITTED" }],
      submissionDetail: {
        id: "sub-e2e-1",
        dds_id: "dds-e2e-1",
        traces_status: "REJECTED",
        status: "SUBMITTED",
        error_message: "Geolocation error on 3 plots.",
      },
    });

    await page.goto("/dashboard");

    // Needs filing
    await expect(page.getByText("PO-2026-0141")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /File DDS/i })).toBeVisible();

    // Needs remediation
    await expect(page.getByText("DDS-2026-0089")).toBeVisible();
    await expect(page.getByText("PO-2026-0138")).toBeVisible();
    await expect(page.getByRole("link", { name: /Remediate/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Review/i })).toBeVisible();

    // Awaiting data
    await expect(page.getByText("PO-2026-0156")).toBeVisible();
    await expect(page.getByText("No lots linked yet")).toBeVisible();

    // Awaiting data — non-blocked PLOTS_COMPLETE (QA finding on PR #46:
    // previously invisible on every card despite an actionable blocker).
    await expect(page.getByText("PO-2026-0212")).toBeVisible();
    await expect(page.getByText("Plots complete")).toBeVisible();
    await expect(page.getByText("1 lot missing harvest period")).toBeVisible();

    // Stat strip
    await expect(page.getByText("1,240 t")).toBeVisible();
  });

  test("all-clear state — every card shows its quiet single-line empty state", async ({ page }) => {
    await stubWorklist(page, {
      readinessResults: [],
      summaryBody: summary({
        blocked_count: 0,
        stage_counts: { OPEN: 0, ALLOCATED: 0, PLOTS_COMPLETE: 8, READY: 0, FILED: 1 },
        funnel: {
          unit: "KG",
          ordered_quantity: "5000000.0000",
          allocated_quantity: "5000000.0000",
          geolocated_quantity: "5000000.0000",
          filed_quantity: "5000000.0000",
          uncovered_quantity: "0.0000",
        },
      }),
      ddsResults: [],
      plotsPendingCount: 0,
    });

    await page.goto("/dashboard");

    await expect(page.getByText("Nothing needs filing — all covered")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Nothing rejected or blocked — no remediation open")).toBeVisible();
    await expect(page.getByText("No orders waiting on data — syncs are up to date")).toBeVisible();
    await expect(page.getByText("0 t")).toBeVisible();
  });
});
