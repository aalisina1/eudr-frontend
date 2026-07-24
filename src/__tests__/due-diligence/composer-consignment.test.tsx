import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { FileDdsComposer } from "@/components/due-diligence/file-dds-composer";
import type { ConsignmentDetail } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

const CONSIGNMENT: ConsignmentDetail = {
  id: "c1", reference: "BL-RED-1", expected_clearance_date: "2026-07-25",
  tracking_number: null, t49_request_id: null, latest_eta: null, eta_source: "NONE",
  created_at: "2026-07-20T00:00:00Z", rag: "RED", covered_count: 0, total_count: 2,
  countdown_to: "2026-07-25",
  lots: [
    { id: "l1", reference_number: "LOT-1", quantity: "1000.0000", unit: "KG", stage: "ALLOCATED", covered: false, covering_dds_id: null, covering_dds_reference: "" },
    { id: "l2", reference_number: "LOT-2", quantity: "500.0000", unit: "KG", stage: "PLOTS_COMPLETE", covered: false, covering_dds_id: null, covering_dds_reference: "" },
  ],
  events: [],
};

function mockApi() {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/consignments/c1/"))
      return Promise.resolve(new Response(JSON.stringify(CONSIGNMENT), { status: 200 }));
    if (url.includes("/supply-chain/batches/payload-estimate/"))
      return Promise.resolve(new Response(JSON.stringify({ estimated_bytes: 100, limit_bytes: 1000, exceeds_limit: false, batches: [], errors: [] }), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
}

describe("FileDdsComposer (consignment anchor)", () => {
  it("pre-fills the composer with the consignment's lots", async () => {
    mockApi();
    await act(async () => { renderWithProviders(<FileDdsComposer consignmentId="c1" />); });
    await waitFor(() => expect(screen.getByText("LOT-1")).toBeInTheDocument());
    expect(screen.getByText("LOT-2")).toBeInTheDocument();
    // back link shows the consignment reference (not a PO)
    expect(screen.getByRole("button", { name: /BL-RED-1/ })).toBeInTheDocument();
  });
});
