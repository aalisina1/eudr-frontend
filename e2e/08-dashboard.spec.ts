/**
 * Dashboard "Decision Ladder" (dashboard-redesign-phase1) — four
 * severity-ranked tiers (Priority Alert -> Action Queue -> Awaiting Data ->
 * Risk concentration) replacing the flat four-card worklist (#30). Live
 * seeded data is sparse, so the "busy" (something in every tier) state is
 * stubbed with `page.route`, following the same pattern `10-submissions.spec.ts`
 * uses for TRACES: stubs registered BEFORE navigation, real backend for
 * auth/nav. The "all clear" state is also stubbed explicitly so the quiet
 * empty-state lines (and the absence of any chart) are locked in regardless
 * of what's actually seeded right now.
 *
 * This is a minimal smoke-level parity check only — the full 17-criterion
 * role-matrix Playwright suite (dashboard-redesign-phase1's own hand-off:
 * "the 17 criteria above become the per-role Playwright journeys") is a
 * separate follow-up.
 */
import { test, expect, type Page } from "@playwright/test";

function readinessRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "po-e2e-1",
    reference_number: "PO-2026-0141",
    seller_id: "sup-e2e-1",
    buyer_id: "buyer-e2e-1",
    product_id: "commodity-e2e-1",
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

/** `GET /api/v1/supply-chain/consignments/summary/` shape — backs Tier 1's
 * headline count and RAG strip. Defaults to all-zero/uncovered so tests that
 * don't care about Tier 1's content still get a well-formed response. */
function consignmentSummary(overrides: Record<string, unknown> = {}) {
  return {
    red: 0,
    amber: 0,
    gray: 0,
    green: 0,
    landing_within_red_window_uncovered: 0,
    ...overrides,
  };
}

/** Stubs every endpoint the decision-ladder tiers read, BEFORE navigation. */
async function stubWorklist(
  page: Page,
  opts: {
    readinessResults: unknown[];
    summaryBody: unknown;
    ddsResults: unknown[];
    latestSubmissions?: { id: string; dds_id: string; status: string }[];
    submissionDetail?: unknown;
    plotsPendingCount?: number;
    plotsFailingCount?: number;
    redConsignmentRows?: unknown[];
    consignmentSummaryBody?: unknown;
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
  // Tier 1 (Priority Alert) + Tier 2's land-soon group — org-wide RAG rollup
  // and the RED consignment rows themselves. Same summary-then-general
  // registration order as the readiness endpoints above (the general route
  // falls back to the summary-specific one for `/summary/` URLs).
  await page.route("**/api/v1/supply-chain/consignments/summary/**", async (route) => {
    await route.fulfill({ json: opts.consignmentSummaryBody ?? consignmentSummary() });
  });
  await page.route("**/api/v1/supply-chain/consignments/**", async (route) => {
    if (route.request().url().includes("/summary/")) return route.fallback();
    const rows = opts.redConsignmentRows ?? [];
    await route.fulfill({ json: { count: rows.length, next: null, previous: null, results: rows } });
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
  // Tier 4b (Risk concentration's "Plots failing validation") shares this
  // same endpoint with the stat strip's "Plots pending validation" — routed
  // by `validation_status` in the URL, mirroring the vitest mocks for
  // `usePlotsPendingValidationCount`/`usePlotsFailingValidationCount`.
  await page.route("**/api/v1/geolocation/plots/**", async (route) => {
    const url = route.request().url();
    const count = url.includes("validation_status=FAILED")
      ? (opts.plotsFailingCount ?? 0)
      : (opts.plotsPendingCount ?? 0);
    await route.fulfill({ json: { count, next: null, previous: null, results: [] } });
  });
}

test.describe("Dashboard decision ladder (dashboard-redesign-phase1)", () => {
  test("loads with a greeting header and the four decision-ladder tiers", async ({ page }) => {
    await stubWorklist(page, { readinessResults: [], summaryBody: summary(), ddsResults: [] });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Priority Alert")).toBeVisible();
    await expect(page.getByText("Action Queue")).toBeVisible();
    await expect(page.getByText("Awaiting data")).toBeVisible();
    await expect(page.getByText("Risk concentration")).toBeVisible();
    await expect(page.getByText("Due Diligence by Status")).toHaveCount(0);
    await expect(page.getByText("Welcome to Canopy")).toHaveCount(0);
  });

  test("busy state — populates the action queue and awaiting-data tiers, plus the stat strip", async ({ page }) => {
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

    // Action Queue — ready-to-file row
    await expect(page.getByText("PO-2026-0141")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /File DDS/i })).toBeVisible();

    // Action Queue — rejected DDS + blocked PO (same group order as the
    // pre-redesign Needs Remediation card it absorbed)
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

    // Stat strip (Tier footer, unchanged/repositioned)
    await expect(page.getByText("1,240 t")).toBeVisible();
  });

  test("all-clear state — every tier shows its quiet single-line empty state", async ({ page }) => {
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

    // Copy updated by #118 (em dashes removed from user-visible strings); this
    // asserts the replacement wording, not the retired one.
    await expect(page.getByText("Nothing needs action. You're caught up.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No orders waiting on data. Syncs are up to date.")).toBeVisible();
    await expect(page.getByText("0 t")).toBeVisible();
  });
});
