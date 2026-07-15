/**
 * Dashboard-as-worklist (#30, Prompt D) — replaces the old chart dashboard.
 * "Good morning" + date, a de-emphasised 4-stat strip, and three
 * priority-ordered WorkCards (Needs filing / Needs remediation / Awaiting
 * data), each with a quiet single-line empty state. No charts anywhere.
 *
 * Covers both demo states from the design snapshot
 * (`eudr-vault/99-Attachments/design-snapshots/2026-07-11/dashboard/worklist.jsx`):
 * "Worklist" (busy — something in every card) and "All clear" (every card
 * empty).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import type { BatchReadiness, DueDiligenceStatement, ReadinessSummary } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-filing",
    reference_number: "PO-2026-0141",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    commodity_id: "commodity-1",
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

const BUSY_READINESS: BatchReadiness[] = [
  readinessRow(),
  readinessRow({
    id: "po-blocked",
    reference_number: "PO-2026-0138",
    stage: "ALLOCATED",
    blocked: true,
    blockers: [{ code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 }],
    next_deadline: null,
  }),
  readinessRow({
    id: "po-open",
    reference_number: "PO-2026-0156",
    stage: "OPEN",
    blockers: [{ code: "NO_LOTS_LINKED", message: "No lots linked yet", count: null }],
    funnel: {
      unit: "KG",
      ordered_quantity: "90000.0000",
      allocated_quantity: "0.0000",
      geolocated_quantity: "0.0000",
      filed_quantity: "0.0000",
      uncovered_quantity: "90000.0000",
    },
    lot_count: 0,
    next_deadline: null,
  }),
];

const BUSY_SUMMARY: ReadinessSummary = {
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
};

const ALL_CLEAR_SUMMARY: ReadinessSummary = {
  po_count: 9,
  stage_counts: { OPEN: 0, ALLOCATED: 0, PLOTS_COMPLETE: 8, READY: 0, FILED: 1 },
  blocked_count: 0,
  funnel: {
    unit: "KG",
    ordered_quantity: "5000000.0000",
    allocated_quantity: "5000000.0000",
    geolocated_quantity: "5000000.0000",
    filed_quantity: "5000000.0000",
    uncovered_quantity: "0.0000",
  },
};

function ddsStatement(overrides: Partial<DueDiligenceStatement> = {}): DueDiligenceStatement {
  return {
    id: "dds-1",
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
    ...overrides,
  };
}

function mockApi({
  readinessResults = [] as BatchReadiness[],
  summary = ALL_CLEAR_SUMMARY,
  ddsResults = [] as DueDiligenceStatement[],
  latestSubmissions = [] as { id: string; dds_id: string; status: string }[],
  submissionDetails = {} as Record<string, unknown>,
  plotsPendingCount = 0,
}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/summary/")) {
      return Promise.resolve(new Response(JSON.stringify(summary), { status: 200 }));
    }
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }));
    }
    if (url.includes("/suppliers/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 }));
    }
    if (url.includes("/due-diligence/statements/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(ddsResults)), { status: 200 }));
    }
    if (/\/traces\/submissions\/[^/?]+\/?$/.test(url)) {
      const id = url.match(/\/traces\/submissions\/([^/?]+)\/?/)?.[1] ?? "";
      return Promise.resolve(new Response(JSON.stringify(submissionDetails[id] ?? {}), { status: 200 }));
    }
    if (url.includes("/traces/submissions/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(latestSubmissions)), { status: 200 }));
    }
    if (url.includes("/geolocation/plots/")) {
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse([], plotsPendingCount)), { status: 200 })
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("DashboardPage — worklist", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders a greeting header and no chart elements", async () => {
    mockApi({});
    renderWithProviders(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument()
    );
    // The old dashboard's donut/bar charts lived under these headings —
    // assert they're gone entirely (design prompt: "no charts anywhere").
    expect(screen.queryByText("Due Diligence by Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Plot Validation Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Welcome to Canopy")).not.toBeInTheDocument();
  });

  it("renders the three worklist card titles in priority order", async () => {
    mockApi({});
    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("Needs filing")).toBeInTheDocument());
    const headings = screen
      .getAllByText(/^(Needs filing|Needs remediation|Awaiting data)$/)
      .map((el) => el.textContent);
    expect(headings).toEqual(["Needs filing", "Needs remediation", "Awaiting data"]);
  });

  describe("busy state", () => {
    it("populates all three cards and the stat strip", async () => {
      mockApi({
        readinessResults: BUSY_READINESS,
        summary: BUSY_SUMMARY,
        ddsResults: [ddsStatement()],
        latestSubmissions: [{ id: "sub-1", dds_id: "dds-1", status: "SUBMITTED" }],
        submissionDetails: {
          "sub-1": {
            id: "sub-1",
            dds_id: "dds-1",
            traces_status: "REJECTED",
            status: "SUBMITTED",
            error_message: "Geolocation error on 3 plots.",
          },
        },
        plotsPendingCount: 61,
      });
      renderWithProviders(<DashboardPage />);

      // Needs filing
      await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /File DDS/i })).toBeInTheDocument();

      // Needs remediation — both the rejected DDS and the blocked PO
      expect(screen.getByText("DDS-2026-0089")).toBeInTheDocument();
      expect(screen.getByText("PO-2026-0138")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Remediate/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Review/i })).toBeInTheDocument();

      // Awaiting data
      expect(screen.getByText("PO-2026-0156")).toBeInTheDocument();
      expect(screen.getByText("No lots linked yet")).toBeInTheDocument();

      // Stat strip
      expect(screen.getByText("1,240 t")).toBeInTheDocument();
    });
  });

  describe("all-clear state", () => {
    it("shows the quiet empty line for all three cards, with no rows", async () => {
      mockApi({ readinessResults: [], summary: ALL_CLEAR_SUMMARY, ddsResults: [], plotsPendingCount: 0 });
      renderWithProviders(<DashboardPage />);

      await waitFor(() => expect(screen.getByText("Nothing needs filing — all covered")).toBeInTheDocument());
      expect(screen.getByText("Nothing rejected or blocked — no remediation open")).toBeInTheDocument();
      expect(screen.getByText("No orders waiting on data — syncs are up to date")).toBeInTheDocument();
      expect(screen.getByText("0 t")).toBeInTheDocument();
    });
  });
});
