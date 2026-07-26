/**
 * The "Decision Ladder" compliance cockpit (dashboard-redesign.md) —
 * replaces the flat four-card worklist (#30). Four severity-ranked tiers
 * (Priority Alert -> Action Queue -> Awaiting Data -> Risk Concentration)
 * plus the demoted StatStrip footer, gated by `currentUser.role`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import type {
  BatchReadiness,
  ConsignmentRow,
  ConsignmentSummary,
  DueDiligenceStatement,
  ReadinessSummary,
  Supplier,
  User,
} from "@/lib/api/types";

const originalFetch = globalThis.fetch;

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "officer@canopy.test",
    username: "officer",
    first_name: "Ali",
    last_name: "S",
    role: "COMPLIANCE_OFFICER",
    organization_id: "org-1",
    organization_name: "Canopy",
    is_staff: false,
    ...overrides,
  };
}

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-filing",
    reference_number: "PO-2026-0141",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    product_id: "commodity-1",
    transaction_date: "2026-07-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: { unit: "KG", ordered_quantity: "500000.0000", allocated_quantity: "500000.0000", geolocated_quantity: "500000.0000", filed_quantity: "250000.0000", uncovered_quantity: "250000.0000" },
    lot_count: 2,
    next_deadline: "2026-07-20",
    ...overrides,
  };
}

const READINESS_SUMMARY: ReadinessSummary = {
  po_count: 9,
  stage_counts: { OPEN: 0, ALLOCATED: 0, PLOTS_COMPLETE: 8, READY: 0, FILED: 1 },
  blocked_count: 0,
  funnel: { unit: "KG", ordered_quantity: "5000000.0000", allocated_quantity: "5000000.0000", geolocated_quantity: "5000000.0000", filed_quantity: "5000000.0000", uncovered_quantity: "0.0000" },
};

const CONSIGNMENT_SUMMARY: ConsignmentSummary = { red: 0, amber: 0, gray: 0, green: 1, landing_within_red_window_uncovered: 0 };

function mockApi({
  currentUser = user(),
  readinessResults = [] as BatchReadiness[],
  readinessSummary = READINESS_SUMMARY,
  consignmentSummary = CONSIGNMENT_SUMMARY,
  redConsignmentRows = [] as ConsignmentRow[],
  ddsResults = [] as DueDiligenceStatement[],
  highRiskSuppliers = [] as Supplier[],
  plotsPendingCount = 0,
  plotsFailingCount = 0,
}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/auth/users/me/")) {
      return Promise.resolve(new Response(JSON.stringify(currentUser), { status: 200 }));
    }
    if (url.includes("/supply-chain/consignments/summary/")) {
      return Promise.resolve(new Response(JSON.stringify(consignmentSummary), { status: 200 }));
    }
    if (url.includes("/supply-chain/consignments/") && url.includes("rag=RED")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(redConsignmentRows)), { status: 200 }));
    }
    if (url.includes("/supply-chain/batches/readiness/summary/")) {
      return Promise.resolve(new Response(JSON.stringify(readinessSummary), { status: 200 }));
    }
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }));
    }
    if (url.includes("/suppliers/") && url.includes("risk_rating=HIGH")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(highRiskSuppliers)), { status: 200 }));
    }
    if (url.includes("/suppliers/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 }));
    }
    if (url.includes("/due-diligence/statements/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(ddsResults)), { status: 200 }));
    }
    if (url.includes("/traces/submissions/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 }));
    }
    if (url.includes("/geolocation/plots/") && url.includes("validation_status=FAILED")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([], plotsFailingCount)), { status: 200 }));
    }
    if (url.includes("/geolocation/plots/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([], plotsPendingCount)), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("DashboardPage — decision ladder cockpit", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the four tiers in priority order, footer last, for COMPLIANCE_OFFICER", async () => {
    mockApi({});
    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("Priority Alert")).toBeInTheDocument());
    const tierTitles = ["Priority Alert", "Action Queue", "Awaiting data", "Risk Concentration"];
    const elements = tierTitles.map((t) => screen.getByText(t));
    for (let i = 1; i < elements.length; i++) {
      expect(elements[i - 1].compareDocumentPosition(elements[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    await waitFor(() => expect(screen.getByText("POs in flight")).toBeInTheDocument());
    expect(
      elements[3].compareDocumentPosition(screen.getByText("POs in flight")) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("populates busy-state content across tiers", async () => {
    mockApi({
      consignmentSummary: { red: 1, amber: 0, gray: 0, green: 0, landing_within_red_window_uncovered: 1 },
      redConsignmentRows: [
        {
          id: "con-1",
          reference: "MSCU-884210",
          expected_clearance_date: "2026-07-27",
          tracking_number: null,
          t49_request_id: null,
          latest_eta: null,
          eta_source: "NONE",
          created_at: "2026-07-01T00:00:00Z",
          rag: "RED",
          covered_count: 3,
          total_count: 4,
          countdown_to: "2026-07-27",
        },
      ],
      readinessResults: [readinessRow()],
    });
    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("MSCU-884210")).toBeInTheDocument());
    expect(screen.getAllByText("PO-2026-0141").length).toBeGreaterThan(0); // Action Queue's filing group
  });

  it("shows the SUPPLIER_CONTACT placeholder with zero org-wide numbers, not the cockpit", async () => {
    mockApi({ currentUser: user({ role: "SUPPLIER_CONTACT" }) });
    renderWithProviders(<DashboardPage />);

    await waitFor(() =>
      expect(screen.getByText(/You don't have access to organization-wide compliance data/i)).toBeInTheDocument()
    );
    expect(screen.queryByText("Priority Alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Action Queue")).not.toBeInTheDocument();
    expect(screen.queryByText("Risk Concentration")).not.toBeInTheDocument();
    expect(screen.queryByText("POs in flight")).not.toBeInTheDocument();
  });

  it("renders the identical cockpit for VIEWER, with every CTA visible (current VIEWER_SEES_DASHBOARD_CTAS=true default)", async () => {
    mockApi({ currentUser: user({ role: "VIEWER" }), readinessResults: [readinessRow()] });
    renderWithProviders(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /File DDS/i })).toBeInTheDocument();
  });

  it("shows a skeleton while the role is still resolving", () => {
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) as typeof fetch;
    const { container } = renderWithProviders(<DashboardPage />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
