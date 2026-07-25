import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { PriorityAlertBanner } from "@/components/dashboard/priority-alert-banner";
import type { ConsignmentRow, ConsignmentSummary } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function summary(overrides: Partial<ConsignmentSummary> = {}): ConsignmentSummary {
  return { red: 0, amber: 0, gray: 0, green: 0, landing_within_red_window_uncovered: 0, ...overrides };
}

function redRow(overrides: Partial<ConsignmentRow> = {}): ConsignmentRow {
  return {
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
    ...overrides,
  };
}

function mockApi({
  summaryBody,
  redRows = [] as ConsignmentRow[],
  summaryStatus = 200,
  redRowsNeverResolve = false,
}: {
  summaryBody: ConsignmentSummary;
  redRows?: ConsignmentRow[];
  summaryStatus?: number;
  redRowsNeverResolve?: boolean;
}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/consignments/summary/")) {
      return summaryStatus === 200
        ? Promise.resolve(new Response(JSON.stringify(summaryBody), { status: 200 }))
        : Promise.resolve(new Response("Internal Server Error", { status: 500 }));
    }
    if (url.includes("/supply-chain/consignments/") && url.includes("rag=RED")) {
      if (redRowsNeverResolve) return new Promise(() => {});
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(redRows)), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
}

describe("PriorityAlertBanner", () => {
  it("shows the calm all-clear banner, RAG strip, and enforcement countdown when nothing is uncovered", async () => {
    mockApi({ summaryBody: summary({ red: 0, amber: 3, gray: 0, green: 1 }) });
    renderWithProviders(<PriorityAlertBanner />);

    await waitFor(() =>
      expect(screen.getByText("Clear — no shipments landing soon without a DDS on file.")).toBeInTheDocument()
    );
    expect(screen.getByText("30 Dec 2026")).toBeInTheDocument();
    expect(screen.getByText(/days out/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // amber count
  });

  it("names the single uncovered consignment and routes its CTA to the consignment detail page", async () => {
    mockApi({
      summaryBody: summary({ red: 1, amber: 3, gray: 0, green: 1, landing_within_red_window_uncovered: 1 }),
      redRows: [redRow()],
    });
    renderWithProviders(<PriorityAlertBanner />);

    await waitFor(() => expect(screen.getByText("MSCU-884210")).toBeInTheDocument());
    expect(screen.getByText(/1 of 4 lots? uncovered/)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /Cover it now/i });
    expect(cta).toHaveAttribute("href", "/shipments/con-1");
  });

  it("shows the total count and the soonest-landing exemplar when more than one is uncovered, routing to the RAG=RED list", async () => {
    mockApi({
      // `red` deliberately > `landing_within_red_window_uncovered` (some RED
      // consignments aren't landing within the window) so the RAG strip's
      // red-count chip doesn't collide with the exemplar's headline "2" —
      // both are real, independent counts that can coincide in production,
      // but the test needs them distinguishable to assert on either alone.
      summaryBody: summary({ red: 5, landing_within_red_window_uncovered: 2 }),
      redRows: [
        redRow({ id: "con-soonest", reference: "MSCU-SOONEST", countdown_to: "2026-07-25" }),
        redRow({ id: "con-later", reference: "MSCU-LATER", countdown_to: "2026-08-10" }),
      ],
    });
    renderWithProviders(<PriorityAlertBanner />);

    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    expect(screen.getByText(/soonest:/)).toBeInTheDocument();
    expect(screen.getByText("MSCU-SOONEST")).toBeInTheDocument();
    expect(screen.queryByText("MSCU-LATER")).not.toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /View all/i });
    expect(cta).toHaveAttribute("href", "/shipments?rag=RED");
  });

  it("degrades to the summary-unavailable message on a failed fetch, without crashing", async () => {
    mockApi({ summaryBody: summary(), summaryStatus: 500 });
    renderWithProviders(<PriorityAlertBanner />);
    await waitFor(() => expect(screen.getByText(/Shipments summary unavailable/i)).toBeInTheDocument());
  });

  it("renders a skeleton while loading", async () => {
    mockApi({ summaryBody: summary(), redRowsNeverResolve: true });
    const { container } = renderWithProviders(<PriorityAlertBanner />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("hides the CTA when showCta is false, without hiding the rest of the exemplar", async () => {
    mockApi({
      summaryBody: summary({ red: 1, landing_within_red_window_uncovered: 1 }),
      redRows: [redRow()],
    });
    renderWithProviders(<PriorityAlertBanner showCta={false} />);

    await waitFor(() => expect(screen.getByText("MSCU-884210")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /Cover it now/i })).not.toBeInTheDocument();
  });
});
