import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import ShipmentDetailPage from "@/app/(dashboard)/shipments/[id]/page";
import type { User } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/shipments/c1",
  useParams: () => ({ id: "c1" }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockApi(role: User["role"] = "COMPLIANCE_OFFICER") {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/auth/users/me/"))
      return Promise.resolve(new Response(JSON.stringify({ id: "u1", role }), { status: 200 }));
    if (url.includes("/ledger/"))
      return Promise.resolve(new Response(JSON.stringify({
        id: "c1", reference: "BL-DETAIL", customs_declaration_reference: "MRN-DETAIL",
        expected_clearance_date: null, created_at: "2026-07-01T00:00:00Z",
        po_references: [], dds_rows: [], uncovered_lot_count: 0,
      }), { status: 200 }));
    if (url.includes("/consignments/c1/"))
      return Promise.resolve(new Response(JSON.stringify({
        id: "c1", reference: "BL-DETAIL", expected_clearance_date: null,
        customs_declaration_reference: "MRN-DETAIL", tracking_number: null,
        t49_request_id: null, latest_eta: null, eta_source: "NONE",
        created_at: "2026-07-01T00:00:00Z", rag: "GRAY", covered_count: 0,
        total_count: 0, countdown_to: null, lots: [], events: [],
      }), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
}

describe("/shipments/[id] reference ledger", () => {
  it("mounts the ledger card on the detail page", async () => {
    mockApi();
    await act(async () => {
      renderWithProviders(<ShipmentDetailPage params={Promise.resolve({ id: "c1" })} />);
    });
    // Wait on the loaded content, not just the card's title — the card's
    // CardHeader (and its "Reference ledger" title) renders in the loading
    // (skeleton) state too, so waiting on the title alone resolves before
    // the ledger fetch settles and the very next synchronous assertion
    // would race it.
    await waitFor(() => expect(screen.getByText("MRN-DETAIL")).toBeInTheDocument());
    expect(screen.getByText("Reference ledger")).toBeInTheDocument();
  });
});
