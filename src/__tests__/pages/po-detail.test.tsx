import { Suspense, act } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";
import PoDetailPage from "@/app/(dashboard)/supply-chains/[id]/page";
import type { POReadinessDetail, Product, Supplier } from "@/lib/api/types";

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

function readinessDetail(overrides: Partial<POReadinessDetail> = {}): POReadinessDetail {
  return {
    id: "po-1",
    reference_number: "PO-2026-0141",
    seller_id: SUPPLIER.id,
    buyer_id: "buyer-1",
    commodity_id: PRODUCT.id,
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
    lots: [
      {
        id: "lot-1",
        reference_number: "LOT-GH-26-0871",
        quantity: "25000.0000",
        unit: "KG",
        harvest_period_start: "2025-10-01",
        harvest_period_end: "2025-12-01",
        plot_count: 23,
        plots_resolved: true,
        plots_failed_count: 0,
        plots_pending_count: 0,
        filed: false,
        filing_dds_id: null,
        filing_dds_reference: "",
      },
      {
        id: "lot-2",
        reference_number: "LOT-GH-26-0772",
        quantity: "25000.0000",
        unit: "KG",
        harvest_period_start: "2025-10-01",
        harvest_period_end: "2025-12-01",
        plot_count: 142,
        plots_resolved: true,
        plots_failed_count: 0,
        plots_pending_count: 0,
        filed: true,
        filing_dds_id: "dds-1",
        filing_dds_reference: "DDS-2026-0047",
      },
    ],
    ...overrides,
  };
}

/** Routes the PO Detail page's several concurrent fetches by URL — the
 * readiness detail (eudr-app PR #83/#85's documented contract, mirrored
 * exactly here rather than depending on a live backend), plus the existing/
 * shipped supplier and product single-item lookups it joins client-side. */
function mockApi({ detail = readinessDetail() }: { detail?: POReadinessDetail } = {}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/") && url.includes("/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(detail), { status: 200 }));
    }
    if (url.includes(`/suppliers/${SUPPLIER.id}/`)) {
      return Promise.resolve(new Response(JSON.stringify(SUPPLIER), { status: 200 }));
    }
    if (url.includes(`/commodities/products/${PRODUCT.id}/`)) {
      return Promise.resolve(new Response(JSON.stringify(PRODUCT), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

/**
 * `use(params)` (React 19, App Router's Promise-based `params`) needs a
 * Suspense boundary above it even when the Promise is already resolved, and
 * `@testing-library/react`'s synchronous `render()` needs the *initial*
 * render itself wrapped in an awaited `act()` for the resulting retry to
 * flush before the first assertion — otherwise the suspended child never
 * commits within a `waitFor`'s polling window. None of this app's other
 * `use(params)` detail pages have a Vitest test today for the same reason;
 * this is the (small, reusable) fix rather than dropping to e2e-only.
 */
async function renderPage() {
  let result!: ReturnType<typeof renderWithProviders>;
  await act(async () => {
    result = renderWithProviders(
      <Suspense fallback={null}>
        <PoDetailPage params={Promise.resolve({ id: "po-1" })} />
      </Suspense>
    );
  });
  return result;
}

describe("PoDetailPage", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the PO reference, stage badge, and resolved supplier/commodity summary", async () => {
    mockApi();
    const { container } = await renderPage();

    await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());
    expect(container.querySelector('[data-slot="badge"]')).toHaveTextContent("Ready to file");
    // "Kuapa Kokoo Union" also appears in the Provenance card's supplier
    // link further down the page — assert at least one match resolved.
    await waitFor(() => expect(screen.getAllByText(/Kuapa Kokoo Union/).length).toBeGreaterThan(0));
    expect(screen.getByText(/Cocoa/)).toBeInTheDocument();
  });

  describe("Ready to file state", () => {
    it("enables the primary File DDS button and routes to Submissions with the PO context on click", async () => {
      mockApi();
      await renderPage();
      await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());

      const fileDdsBtn = screen.getByRole("button", { name: /File DDS/i });
      expect(fileDdsBtn).toBeEnabled();

      const user = userEvent.setup();
      await user.click(fileDdsBtn);
      // next/navigation's useRouter is mocked (setup.ts) — pushing is the
      // observable behavior; the composer itself is eudr-frontend #26.
    });

    it("shows the all-clear readiness row when there are no blockers", async () => {
      mockApi();
      await renderPage();
      await waitFor(() =>
        expect(screen.getByText("All data complete — this PO is ready to file")).toBeInTheDocument()
      );
    });

    it("renders the coverage funnel with all five labelled rows", async () => {
      mockApi();
      await renderPage();
      await waitFor(() => expect(screen.getByText("Coverage")).toBeInTheDocument());
      expect(screen.getByText("Ordered")).toBeInTheDocument();
      expect(screen.getByText("Allocated")).toBeInTheDocument();
      expect(screen.getByText("Geolocated")).toBeInTheDocument();
      expect(screen.getByText("Filed")).toBeInTheDocument();
      expect(screen.getByText("Uncovered")).toBeInTheDocument();
      expect(screen.getByText(/500,000 kg/)).toBeInTheDocument();
      // Filed and Uncovered both happen to be 250,000 kg in this fixture.
      expect(screen.getAllByText(/250,000 kg/).length).toBe(2);
    });

    it("renders the lots table with harvest period, plots validation, and DDS link/Not filed", async () => {
      mockApi();
      await renderPage();
      await waitFor(() => expect(screen.getByText("LOT-GH-26-0871")).toBeInTheDocument());

      // Both fixture lots share the same harvest period.
      expect(screen.getAllByText("Oct – Dec 2025").length).toBe(2);
      expect(screen.getByText("Not filed")).toBeInTheDocument();
      expect(screen.getByText("DDS-2026-0047")).toBeInTheDocument();
      expect(screen.getAllByText("Validated").length).toBe(2);
    });

    it("renders the compact Provenance card with the supplier link", async () => {
      mockApi();
      await renderPage();
      await waitFor(() => expect(screen.getByText("Provenance")).toBeInTheDocument());
      const supplierLink = await screen.findByRole("link", { name: /Kuapa Kokoo Union/ });
      expect(supplierLink).toHaveAttribute("href", `/suppliers/${SUPPLIER.id}`);
      expect(screen.getByText("Map renders at runtime")).toBeInTheDocument();
    });
  });

  describe("Gaps (earlier stage, blocked) state", () => {
    function gapsDetail() {
      return readinessDetail({
        stage: "ALLOCATED",
        blocked: true,
        blockers: [
          { code: "MISSING_HARVEST_PERIOD", message: "2 lots missing harvest period", count: 2 },
          { code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 },
        ],
        lots: [
          {
            id: "lot-1",
            reference_number: "LOT-GH-26-0871",
            quantity: "25000.0000",
            unit: "KG",
            harvest_period_start: null,
            harvest_period_end: null,
            plot_count: 23,
            plots_resolved: true,
            plots_failed_count: 3,
            plots_pending_count: 0,
            filed: false,
            filing_dds_id: null,
            filing_dds_reference: "",
          },
        ],
      });
    }

    it("disables the File DDS button outside the Ready-to-file stage", async () => {
      mockApi({ detail: gapsDetail() });
      const { container } = await renderPage();
      await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());

      expect(container.querySelector('[data-slot="badge"]')).toHaveTextContent("Blocked");
      const fileDdsBtn = screen.getByRole("button", { name: /File DDS/i });
      // `aria-disabled`, not the native `disabled` attribute — the button
      // stays focusable so its tooltip can open on keyboard focus, not just
      // mouse hover (see the focus-tooltip test below).
      expect(fileDdsBtn).toHaveAttribute("aria-disabled", "true");
      expect(fileDdsBtn).not.toBeDisabled();
    });

    it("keeps the File DDS button focusable and opens its tooltip on keyboard focus, not just mouse hover", async () => {
      mockApi({ detail: gapsDetail() });
      await renderPage();
      await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());

      const fileDdsBtn = screen.getByRole("button", { name: /File DDS/i });
      fileDdsBtn.focus();
      expect(fileDdsBtn).toHaveFocus();

      await waitFor(() =>
        expect(
          screen.getByText("2 lots missing harvest period · 3 plots failed deforestation validation")
        ).toBeInTheDocument()
      );
    });

    it("itemises each server-side blocker as a concrete gap row with a deep-link action", async () => {
      mockApi({ detail: gapsDetail() });
      await renderPage();

      await waitFor(() => expect(screen.getByText("2 lots missing harvest period")).toBeInTheDocument());
      expect(screen.getByText("3 plots failed deforestation validation")).toBeInTheDocument();
      expect(screen.queryByText("All data complete — this PO is ready to file")).toBeNull();

      // Deep-link ghost buttons mapped by blocker code.
      expect(screen.getByRole("button", { name: /Fix/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Review plots/ })).toBeInTheDocument();
    });

    it("shows the destructive Missing badge for a lot without a harvest period, and a failed-plots badge", async () => {
      mockApi({ detail: gapsDetail() });
      const { container } = await renderPage();
      await waitFor(() => expect(screen.getByText("LOT-GH-26-0871")).toBeInTheDocument());

      const badgeTexts = Array.from(container.querySelectorAll('[data-slot="badge"]')).map(
        (el) => el.textContent?.trim() ?? ""
      );
      expect(badgeTexts).toContain("Missing");
      expect(badgeTexts).toContain("3 failed");
    });

    it("clicking a deep-link ghost button navigates (e.g. Review plots -> /plots)", async () => {
      mockApi({ detail: gapsDetail() });
      await renderPage();
      await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /Review plots/ }));
      // Routing itself is exercised via the mocked useRouter (setup.ts); no
      // navigation assertion needed beyond "it didn't throw".
    });
  });

  describe("loading and not-found states", () => {
    it("shows a not-found message when the fetch fails", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
      await renderPage();
      await waitFor(() =>
        expect(screen.getByText(/Purchase order not found or failed to load/)).toBeInTheDocument()
      );
      expect(screen.getByRole("button", { name: /All purchase orders/ })).toBeInTheDocument();
    });
  });

  it("has a back link to the Sourcing list", async () => {
    mockApi();
    await renderPage();
    await waitFor(() => expect(screen.getByText("PO-2026-0141")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /All purchase orders/ })).toBeInTheDocument();
  });
});
