import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { StatStrip } from "@/components/dashboard/stat-strip";
import type { ReadinessSummary } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

function summary(overrides: Partial<ReadinessSummary> = {}): ReadinessSummary {
  return {
    po_count: 9,
    stage_counts: { OPEN: 2, ALLOCATED: 3, PLOTS_COMPLETE: 1, READY: 2, FILED: 1 },
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

function mockApi({
  summaryBody = summary(),
  ddsResults = [{ id: "d1", status: "SUBMITTED", submitted_at: new Date().toISOString() }],
  plotsPendingCount = 61,
}: {
  summaryBody?: ReadinessSummary;
  ddsResults?: unknown[];
  plotsPendingCount?: number;
} = {}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/summary/")) {
      return Promise.resolve(new Response(JSON.stringify(summaryBody), { status: 200 }));
    }
    if (url.includes("/due-diligence/statements/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(ddsResults)), { status: 200 }));
    }
    if (url.includes("/geolocation/plots/")) {
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse([], plotsPendingCount)), { status: 200 })
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("StatStrip", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the four de-emphasised stat labels", async () => {
    mockApi();
    renderWithProviders(<StatStrip />);
    await waitFor(() => expect(screen.getByText("POs in flight")).toBeInTheDocument());
    expect(screen.getByText("Tonnes uncovered")).toBeInTheDocument();
    expect(screen.getByText("Statements filed this quarter")).toBeInTheDocument();
    expect(screen.getByText("Plots pending validation")).toBeInTheDocument();
  });

  it("derives POs in flight (po_count minus FILED) and tonnes uncovered (KG -> t) from the summary endpoint", async () => {
    mockApi();
    renderWithProviders(<StatStrip />);
    // po_count 9, stage_counts.FILED 1 -> 8 in flight.
    await waitFor(() => expect(screen.getByText("8")).toBeInTheDocument());
    expect(screen.getByText("1,240 t")).toBeInTheDocument();
  });

  it("shows the plots-pending-validation count from the plots endpoint", async () => {
    mockApi({ plotsPendingCount: 61 });
    renderWithProviders(<StatStrip />);
    await waitFor(() => expect(screen.getByText("61")).toBeInTheDocument());
  });

  it("counts only SUBMITTED statements submitted within the current quarter", async () => {
    const now = new Date();
    const thisQuarter = now.toISOString();
    const lastYear = new Date(now.getFullYear() - 1, 0, 15).toISOString();
    mockApi({
      ddsResults: [
        { id: "d1", status: "SUBMITTED", submitted_at: thisQuarter },
        { id: "d2", status: "SUBMITTED", submitted_at: thisQuarter },
        { id: "d3", status: "SUBMITTED", submitted_at: lastYear },
        { id: "d4", status: "DRAFT", submitted_at: null },
      ],
    });
    renderWithProviders(<StatStrip />);
    await waitFor(() => expect(screen.getByText("Statements filed this quarter").previousSibling?.textContent).toBe("2"));
  });

  it("renders zero tonnes uncovered as '0 t' (all-clear state)", async () => {
    mockApi({
      summaryBody: summary({
        funnel: {
          unit: "KG",
          ordered_quantity: "5000000.0000",
          allocated_quantity: "5000000.0000",
          geolocated_quantity: "5000000.0000",
          filed_quantity: "5000000.0000",
          uncovered_quantity: "0.0000",
        },
      }),
    });
    renderWithProviders(<StatStrip />);
    await waitFor(() => expect(screen.getByText("0 t")).toBeInTheDocument());
  });
});
