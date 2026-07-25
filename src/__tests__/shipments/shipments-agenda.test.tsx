import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { ShipmentsAgenda } from "@/components/shipments/shipments-agenda";
import type { ConsignmentRow } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

// Relative offsets keep the buckets stable across calendar days (the
// component buckets against the real `new Date()`, like the list test).
function iso(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}
function row(over: Partial<ConsignmentRow>): ConsignmentRow {
  return {
    id: Math.random().toString(36).slice(2), reference: "REF",
    expected_clearance_date: null, tracking_number: null, t49_request_id: null,
    latest_eta: null, eta_source: "NONE", created_at: "2026-07-01T00:00:00Z",
    rag: "RED", covered_count: 0, total_count: 1, countdown_to: null, ...over,
  };
}
function mockAgenda(rows: ConsignmentRow[]) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(rows), { status: 200 })
  ) as typeof fetch;
}
async function renderAgenda(rag = "", search = "") {
  await act(async () => {
    renderWithProviders(<ShipmentsAgenda rag={rag} search={search} canWrite />);
  });
}

describe("ShipmentsAgenda", () => {
  it("renders bucket headers with counts", async () => {
    mockAgenda([
      row({ reference: "OVR", countdown_to: iso(-2), rag: "RED" }),
      row({ reference: "SOON", countdown_to: iso(3), rag: "RED" }),
    ]);
    await renderAgenda();
    await waitFor(() => expect(screen.getByText("OVR")).toBeInTheDocument());
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is returned", async () => {
    mockAgenda([]);
    await renderAgenda();
    await waitFor(() =>
      expect(screen.getByText("Nothing arriving that needs a DDS")).toBeInTheDocument());
  });

  it("shows the filtered zero-results state (not the first-run empty state) when a filter is active", async () => {
    mockAgenda([]);
    await renderAgenda("RED", "");
    await waitFor(() =>
      expect(screen.getByText("No consignments match these filters")).toBeInTheDocument());
    expect(screen.queryByText("Nothing arriving that needs a DDS")).toBeNull();
  });

  it("sends rag and search as query params to the agenda endpoint", async () => {
    mockAgenda([]);
    await renderAgenda("RED", "BL-9");
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [requested] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = typeof requested === "string" ? requested : requested.toString();
    expect(url).toContain("/consignments/agenda/");
    expect(url).toContain("rag=RED");
    expect(url).toContain("search=BL-9");
  });
});
