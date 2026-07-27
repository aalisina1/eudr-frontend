import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { RiskConcentrationCard } from "@/components/dashboard/risk-concentration-card";
import type { BatchReadiness, DueDiligenceStatement, Supplier } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0141",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    product_id: "commodity-1",
    transaction_date: "2026-07-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: { unit: "KG", ordered_quantity: "1000.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "1000.0000" },
    lot_count: 1,
    next_deadline: null,
    ...overrides,
  };
}

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "sup-high",
    name: "Ivoire Cocoa",
    country_of_origin: "CI",
    kyc_status: "VERIFIED",
    risk_rating: "HIGH",
    external_id: "",
    managed_by_id: "u1",
    supplier_organization_id: null,
    kyc_verified_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function ddsStatement(overrides: Partial<DueDiligenceStatement> = {}): DueDiligenceStatement {
  return {
    id: "dds-1",
    reference_number: "DDS-2026-0001",
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
    submitted_at: "2026-01-01T00:00:00Z",
    valid_until: null,
    archived_until: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockApi({
  readinessResults = [] as BatchReadiness[],
  highRiskSuppliers = [] as Supplier[],
  plotsFailingCount = 0,
  ddsResults = [] as DueDiligenceStatement[],
  highRiskStatus = 200,
}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }));
    }
    if (url.includes("/suppliers/") && url.includes("risk_rating=HIGH")) {
      return highRiskStatus === 200
        ? Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(highRiskSuppliers)), { status: 200 }))
        : Promise.resolve(new Response("error", { status: 500 }));
    }
    if (url.includes("/geolocation/plots/") && url.includes("validation_status=FAILED")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([], plotsFailingCount)), { status: 200 }));
    }
    if (url.includes("/due-diligence/statements/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(ddsResults)), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("RiskConcentrationCard", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("computes high-risk supplier count and KG-normalised volume share", async () => {
    mockApi({
      readinessResults: [
        readinessRow({ id: "po-1", seller_id: "sup-high", funnel: { unit: "KG", ordered_quantity: "1000.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "1000.0000" } }),
        readinessRow({ id: "po-2", seller_id: "sup-std", funnel: { unit: "KG", ordered_quantity: "3000.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "3000.0000" } }),
      ],
      highRiskSuppliers: [supplier()],
    });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText(/1 supplier/)).toBeInTheDocument());
    expect(screen.getByText(/25% vol/)).toBeInTheDocument();
    expect(screen.getByText(/Côte d.Ivoire/)).toBeInTheDocument();
    // Filtered doorway (dashboard-redesign-phase1 filtering addendum, Task 8
    // amendment): the click-through opens `/suppliers` pre-filtered to HIGH.
    const highRiskRow = screen.getByText("Suppliers flagged high-risk").closest("a");
    expect(highRiskRow).toHaveAttribute("href", "/suppliers?risk_rating=HIGH");
  });

  it("matches the plots-failing count to the paginator's count field exactly", async () => {
    mockApi({ plotsFailingCount: 3 });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Plots failing validation")).toBeInTheDocument());
    const row = screen.getByText("Plots failing validation").closest("a");
    expect(row).toHaveTextContent("3");
    // Filtered doorway (dashboard-redesign-phase1 filtering addendum, Task 8
    // amendment): the click-through opens `/plots` pre-filtered to FAILED.
    expect(row).toHaveAttribute("href", "/plots?validation_status=FAILED");
  });

  it("counts SUBMITTED DDS expiring within 90 days from the already-fetched statements", async () => {
    // Dates are relative to the real clock on purpose. The component calls
    // `countDdsExpiringWithin90Days(statements)` without an injected `now`, so a
    // hardcoded `valid_until` would silently drift out of the 90-day window as
    // real-world time passes and turn this into a time bomb. Fake timers are the
    // usual answer but deadlock against React Query's `waitFor` polling, and this
    // suite has no fake-timer precedent — relative fixtures need neither.
    const isoDate = (offsetDays: number) =>
      new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
    mockApi({
      ddsResults: [
        ddsStatement({ status: "SUBMITTED", valid_until: isoDate(30) }), // inside the window
        ddsStatement({ status: "SUBMITTED", valid_until: isoDate(180) }), // outside it
      ],
    });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Filed DDS expiring < 90 days")).toBeInTheDocument());
    const row = screen.getByText("Filed DDS expiring < 90 days").closest("a");
    // Assert the rendered COUNT, not just the label: with one statement inside
    // the window and one outside, "1" fails for a broken filter, a stuck "—", and
    // a stuck loading state alike. Asserting only the label/href (as this test
    // originally did) passes for all three.
    expect(row).toHaveTextContent("1");
    // Filtered doorway (dashboard-redesign-phase1 filtering addendum, Task 8
    // amendment): the click-through opens `/due-diligence` pre-filtered to
    // SUBMITTED (soonest-`valid_until` ordering was evaluated and found
    // infeasible frontend-only — see Task 7.3 — so this is filter-only).
    expect(row).toHaveAttribute("href", "/due-diligence?status=SUBMITTED");
  });

  it("shows a muted dash for a failed metric without blanking the other rows", async () => {
    mockApi({ highRiskStatus: 500, plotsFailingCount: 2 });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Plots failing validation")).toBeInTheDocument());
    const highRiskRow = screen.getByText("Suppliers flagged high-risk").closest("a");
    expect(highRiskRow).toHaveTextContent("—");
    const plotsRow = screen.getByText("Plots failing validation").closest("a");
    expect(plotsRow).toHaveTextContent("2");
  });

  it("shows literal zero rows when everything is clean, not a collapsed empty state", async () => {
    mockApi({});
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Suppliers flagged high-risk")).toBeInTheDocument());
    expect(screen.queryByText(/caught up/i)).not.toBeInTheDocument();
    const plotsRow = screen.getByText("Plots failing validation").closest("a");
    expect(plotsRow).toHaveTextContent("0");
  });
});
