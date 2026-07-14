import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { NeedsFilingCard } from "@/components/dashboard/needs-filing-card";
import type { BatchReadiness, Supplier } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

const SUPPLIER: Supplier = {
  id: "sup-1",
  name: "Kuapa Kokoo Union",
  country_of_origin: "GH",
  kyc_status: "VERIFIED",
  risk_rating: "STANDARD",
  external_id: "",
  managed_by_id: "u1",
  supplier_organization_id: null,
  kyc_verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0141",
    seller_id: SUPPLIER.id,
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

function mockApi({ readinessResults = [readinessRow()] }: { readinessResults?: BatchReadiness[] } = {}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }));
    }
    if (url.includes("/suppliers/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([SUPPLIER])), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("NeedsFilingCard", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders a READY PO with ref, supplier, deadline chip, uncovered qty, and a File DDS button", async () => {
    mockApi();
    renderWithProviders(<NeedsFilingCard />);

    await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());
    expect(screen.getByText("Kuapa Kokoo Union")).toBeInTheDocument();
    expect(screen.getByText(/ETA 20 Jul/)).toBeInTheDocument();
    expect(screen.getByText(/250,?000\s*kg uncovered/)).toBeInTheDocument();
    const button = screen.getByRole("link", { name: /File DDS/i });
    expect(button).toHaveAttribute("href", "/supply-chains/po-1");
  });

  it("excludes non-READY and blocked POs", async () => {
    mockApi({
      readinessResults: [
        readinessRow({ id: "po-2", reference_number: "PO-OPEN", stage: "OPEN", next_deadline: null }),
        readinessRow({ id: "po-3", reference_number: "PO-BLOCKED", blocked: true }),
      ],
    });
    renderWithProviders(<NeedsFilingCard />);

    await waitFor(() => expect(screen.getByText("Nothing needs filing — all covered")).toBeInTheDocument());
    expect(screen.queryByText("PO-OPEN")).not.toBeInTheDocument();
    expect(screen.queryByText("PO-BLOCKED")).not.toBeInTheDocument();
  });

  it("sorts the soonest/overdue deadline first", async () => {
    mockApi({
      readinessResults: [
        readinessRow({ id: "po-soon", reference_number: "PO-SOON", next_deadline: "2026-07-20" }),
        readinessRow({ id: "po-overdue", reference_number: "PO-OVERDUE", next_deadline: "2026-06-30" }),
      ],
    });
    renderWithProviders(<NeedsFilingCard />);

    await waitFor(() => expect(screen.getByText("PO-OVERDUE")).toBeInTheDocument());
    const refs = screen.getAllByRole("link", { name: /^PO-/ }).map((el) => el.textContent);
    expect(refs).toEqual(["PO-OVERDUE", "PO-SOON"]);
  });

  it("shows the quiet empty state when nothing is ready to file", async () => {
    mockApi({ readinessResults: [] });
    renderWithProviders(<NeedsFilingCard />);
    await waitFor(() => expect(screen.getByText("Nothing needs filing — all covered")).toBeInTheDocument());
  });
});
