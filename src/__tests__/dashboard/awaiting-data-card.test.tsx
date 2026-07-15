import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { AwaitingDataCard } from "@/components/dashboard/awaiting-data-card";
import type { BatchReadiness } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0156",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    product_id: "commodity-1",
    transaction_date: "2026-07-01",
    stage: "OPEN",
    blocked: false,
    blockers: [{ code: "NO_LOTS_LINKED", message: "No lots linked yet", count: null }],
    funnel: {
      unit: "KG",
      ordered_quantity: "500000.0000",
      allocated_quantity: "0.0000",
      geolocated_quantity: "0.0000",
      filed_quantity: "0.0000",
      uncovered_quantity: "500000.0000",
    },
    lot_count: 0,
    next_deadline: null,
    ...overrides,
  };
}

function mockApi(readinessResults: BatchReadiness[]) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("AwaitingDataCard", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders an OPEN PO with a stage badge and the blocker's message as the muted note", async () => {
    mockApi([readinessRow()]);
    renderWithProviders(<AwaitingDataCard />);

    await waitFor(() => expect(screen.getByText("PO-2026-0156")).toBeInTheDocument());
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("No lots linked yet")).toBeInTheDocument();
  });

  it("renders an ALLOCATED PO with its own blocker note", async () => {
    mockApi([
      readinessRow({
        id: "po-2",
        reference_number: "PO-2026-0149",
        stage: "ALLOCATED",
        blockers: [{ code: "MISSING_GEOLOCATION", message: "2 lots missing plot geolocation", count: 2 }],
      }),
    ]);
    renderWithProviders(<AwaitingDataCard />);

    await waitFor(() => expect(screen.getByText("PO-2026-0149")).toBeInTheDocument());
    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(screen.getByText("2 lots missing plot geolocation")).toBeInTheDocument();
  });

  it("excludes blocked and READY/FILED POs", async () => {
    mockApi([
      readinessRow({ id: "po-blocked", reference_number: "PO-BLOCKED", blocked: true }),
      readinessRow({ id: "po-ready", reference_number: "PO-READY", stage: "READY" }),
      readinessRow({ id: "po-filed", reference_number: "PO-FILED", stage: "FILED" }),
    ]);
    renderWithProviders(<AwaitingDataCard />);

    await waitFor(() => expect(screen.getByText("No orders waiting on data — syncs are up to date")).toBeInTheDocument());
    expect(screen.queryByText("PO-BLOCKED")).not.toBeInTheDocument();
    expect(screen.queryByText("PO-READY")).not.toBeInTheDocument();
    expect(screen.queryByText("PO-FILED")).not.toBeInTheDocument();
  });

  it("includes a non-blocked PLOTS_COMPLETE PO — it still has an actionable blocker message", async () => {
    mockApi([
      readinessRow({
        id: "po-plots-complete",
        reference_number: "PO-2026-0212",
        stage: "PLOTS_COMPLETE",
        blockers: [{ code: "MISSING_HARVEST_PERIOD", message: "1 lot missing harvest period", count: 1 }],
        next_deadline: "2026-08-20",
      }),
    ]);
    renderWithProviders(<AwaitingDataCard />);

    await waitFor(() => expect(screen.getByText("PO-2026-0212")).toBeInTheDocument());
    expect(screen.getByText("Plots complete")).toBeInTheDocument();
    expect(screen.getByText("1 lot missing harvest period")).toBeInTheDocument();
  });

  it("shows the quiet empty state when nothing is waiting on data", async () => {
    mockApi([]);
    renderWithProviders(<AwaitingDataCard />);
    await waitFor(() => expect(screen.getByText("No orders waiting on data — syncs are up to date")).toBeInTheDocument());
  });
});
