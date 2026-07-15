import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import SourcingPage from "@/app/(dashboard)/supply-chains/page";
import type { BatchReadiness, Product, Supplier } from "@/lib/api/types";

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

const PRODUCT: Product = {
  id: "prod-1",
  commodity: "commodity-1",
  commodity_name: "Cocoa",
  species: null,
  description: "Fermented cocoa beans",
  internal_product_code: "COCOA-01",
  cn_code: "1801",
  is_active: true,
};

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0141",
    seller_id: SUPPLIER.id,
    buyer_id: "buyer-1",
    product_id: PRODUCT.id,
    transaction_date: "2026-07-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "500000.0000",
      allocated_quantity: "300000.0000",
      geolocated_quantity: "280000.0000",
      filed_quantity: "250000.0000",
      uncovered_quantity: "250000.0000",
    },
    lot_count: 2,
    next_deadline: null,
    ...overrides,
  };
}

/** Routes the Sourcing page's several concurrent fetches by URL — the
 * readiness list (eudr-app PR #83's documented contract, mirrored exactly
 * here rather than depending on a live backend), plus the existing/shipped
 * suppliers, products, and current-user endpoints it joins in client-side. */
function mockApi({ readinessResults = [readinessRow()] }: { readinessResults?: BatchReadiness[] } = {}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 })
      );
    }
    if (url.includes("/commodities/products/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([PRODUCT])), { status: 200 }));
    }
    if (url.includes("/suppliers/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([SUPPLIER])), { status: 200 }));
    }
    if (url.includes("/auth/users/me/")) {
      return Promise.resolve(
        new Response(JSON.stringify({ id: "u1", role: "COMPLIANCE_OFFICER", organization_id: "org-1" }), {
          status: 200,
        })
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

/** The page's own "Stage" filter renders `<option>Ready to file</option>` /
 * `<option>Blocked</option>` etc. alongside the real stage `Badge`s, so a
 * plain `getByText("Blocked")` is ambiguous (matches both). Scope badge
 * assertions to `[data-slot="badge"]` to test the actual row badges. */
function badgeTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-slot="badge"]')).map((el) => el.textContent?.trim() ?? "");
}

describe("SourcingPage", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the Sourcing title and description", () => {
    mockApi();
    renderWithProviders(<SourcingPage />);
    expect(screen.getByRole("heading", { name: "Sourcing" })).toBeInTheDocument();
    expect(screen.getByText("Purchase orders and the lots fulfilling them")).toBeInTheDocument();
  });

  it("renders a PO row with resolved supplier/commodity, stage badge, lot count, and coverage caption", async () => {
    mockApi();
    const { container } = renderWithProviders(<SourcingPage />);

    await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());
    expect(screen.getByText("Kuapa Kokoo Union")).toBeInTheDocument();
    expect(screen.getByText("Cocoa")).toBeInTheDocument();
    expect(badgeTexts(container)).toContain("Ready to file");
    expect(screen.getByText("2 lots")).toBeInTheDocument();
    // Native unit (KG), not an invented tonnes conversion — PR #83: "per-PO
    // list/detail views show native units".
    expect(screen.getByText(/250,?000\s*\/\s*500,?000\s*kg filed/)).toBeInTheDocument();
    // Next-deadline placeholder — BE-B (eudr-app #61) hasn't shipped yet.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the Blocked overlay (winning over the underlying stage) with its blocker message", async () => {
    mockApi({
      readinessResults: [
        readinessRow({
          id: "po-2",
          reference_number: "PO-2026-0138",
          stage: "ALLOCATED",
          blocked: true,
          blockers: [
            { code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 },
          ],
        }),
      ],
    });
    const { container } = renderWithProviders(<SourcingPage />);

    await waitFor(() => expect(screen.getByText("PO-2026-0138")).toBeInTheDocument());
    expect(badgeTexts(container)).toContain("Blocked");
    expect(badgeTexts(container)).not.toContain("Allocated");
    expect(screen.getByText("3 plots failed deforestation validation")).toBeInTheDocument();
  });

  it("falls back to a muted id tail when a supplier/product isn't in the lookup", async () => {
    mockApi({ readinessResults: [readinessRow({ seller_id: "unresolved-seller-uuid" })] });
    renderWithProviders(<SourcingPage />);

    await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());
    expect(screen.getByText("ler-uuid")).toBeInTheDocument(); // slice(-8) of "unresolved-seller-uuid"
  });

  it("renders the unified 7-option Stage filter (Blocked included, per the canonical design)", () => {
    mockApi();
    renderWithProviders(<SourcingPage />);

    const select = screen.getByLabelText("Filter by stage");
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual([
      "All stages",
      "Open",
      "Allocated",
      "Plots complete",
      "Ready to file",
      "Filed",
      "Blocked",
    ]);
  });

  it("shows the empty state with New purchase order + Connect a data source actions", async () => {
    mockApi({ readinessResults: [] });
    renderWithProviders(<SourcingPage />);

    await waitFor(() => expect(screen.getByText("No purchase orders yet")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: /New purchase order/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Connect a data source/i })).toBeInTheDocument();
  });

  it("opens the New Purchase Order sheet with the no-plots helper line", async () => {
    mockApi();
    renderWithProviders(<SourcingPage />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("button", { name: /New purchase order/i })[0]);
    expect(await screen.findByText(/No plots are picked here/i)).toBeInTheDocument();
  });

  it("shows validation errors when the New Purchase Order form is submitted empty", async () => {
    mockApi();
    renderWithProviders(<SourcingPage />);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("button", { name: /New purchase order/i })[0]);
    await screen.findByText(/No plots are picked here/i);
    await user.click(screen.getByRole("button", { name: /Create purchase order/i }));

    expect(await screen.findByText("Enter a PO reference")).toBeInTheDocument();
    expect(screen.getByText("Choose a supplier")).toBeInTheDocument();
    expect(screen.getByText("Choose a commodity")).toBeInTheDocument();
  });
});
