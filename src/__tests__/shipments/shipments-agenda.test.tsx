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
async function renderAgenda() {
  await act(async () => {
    renderWithProviders(<ShipmentsAgenda rag="" search="" canWrite />);
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
});
