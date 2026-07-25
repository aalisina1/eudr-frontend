import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  renderWithProviders,
  mockPaginatedResponse,
} from "../helpers";
import SuppliersPage from "@/app/(dashboard)/suppliers/page";
import type { Supplier } from "@/lib/api/types";

// File-level mock (house pattern — see file-dds-composer-routing.test.tsx /
// shipments-list.test.tsx): the global next/navigation mock in setup.ts always
// returns an EMPTY URLSearchParams, so the `?risk_rating=` seeding tests below
// need a mutable `searchParams` this file can reassign per test.
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/suppliers",
  useParams: () => ({}),
  useSearchParams: () => searchParams,
  redirect: vi.fn(),
}));

const mockSuppliers: Supplier[] = [
  {
    id: "s1",
    name: "Green Farm Co",
    country_of_origin: "Brazil",
    kyc_status: "VERIFIED",
    risk_rating: "LOW",
    external_id: "EXT-001",
    managed_by_id: "org-1",
    supplier_organization_id: null,
    kyc_verified_at: "2026-01-15T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "s2",
    name: "Timber Ltd",
    country_of_origin: "Indonesia",
    kyc_status: "PENDING",
    risk_rating: "HIGH",
    external_id: "",
    managed_by_id: "org-1",
    supplier_organization_id: null,
    kyc_verified_at: null,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
];

const originalFetch = globalThis.fetch;

describe("SuppliersPage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse(mockSuppliers)),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
    vi.restoreAllMocks();
  });

  it("renders the page title", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(
      screen.getByText("Manage your supply chain partners")
    ).toBeInTheDocument();
  });

  it("renders the Add Supplier button", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("Add Supplier")).toBeInTheDocument();
  });

  it("renders supplier names after loading", async () => {
    renderWithProviders(<SuppliersPage />);
    await waitFor(() => {
      expect(screen.getByText("Green Farm Co")).toBeInTheDocument();
    });
    expect(screen.getByText("Timber Ltd")).toBeInTheDocument();
  });

  it("renders KYC status badges", async () => {
    renderWithProviders(<SuppliersPage />);
    await waitFor(() => {
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders risk rating badges", async () => {
    renderWithProviders(<SuppliersPage />);
    await waitFor(() => {
      expect(screen.getByText("Low")).toBeInTheDocument();
    });
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders filter dropdowns", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("All KYC Status")).toBeInTheDocument();
    expect(screen.getByText("All Risk Levels")).toBeInTheDocument();
  });

  it("renders export CSV button", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dashboard Tier 4a filtered doorway (dashboard-redesign-phase1 filtering
// addendum, Task 7.1): `/suppliers?risk_rating=HIGH` must land pre-filtered.
// ---------------------------------------------------------------------------
describe("SuppliersPage — risk_rating URL param (dashboard filtered doorway)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
    vi.restoreAllMocks();
  });

  it("requests risk_rating=HIGH from the API when ?risk_rating=HIGH is present", async () => {
    searchParams = new URLSearchParams("risk_rating=HIGH");
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse([mockSuppliers[1]])), { status: 200 })
      );
    }) as typeof fetch;

    renderWithProviders(<SuppliersPage />);
    await waitFor(() => expect(screen.getByText("Timber Ltd")).toBeInTheDocument());
    expect(calls.some((url) => url.includes("risk_rating=HIGH"))).toBe(true);
  });

  it("pre-selects High in the risk-rating filter when ?risk_rating=HIGH is present", async () => {
    searchParams = new URLSearchParams("risk_rating=HIGH");
    renderWithProviders(<SuppliersPage />);
    await waitFor(() => {
      const select = screen.getByLabelText(/Risk rating/i) as HTMLSelectElement;
      expect(select.value).toBe("HIGH");
    });
  });

  it("degrades to the unfiltered list when risk_rating is absent", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(mockSuppliers)), { status: 200 }));
    }) as typeof fetch;

    renderWithProviders(<SuppliersPage />);
    await waitFor(() => expect(screen.getByText("Green Farm Co")).toBeInTheDocument());
    expect(calls.some((url) => url.includes("risk_rating="))).toBe(false);
    expect((screen.getByLabelText(/Risk rating/i) as HTMLSelectElement).value).toBe("");
  });

  it("degrades to the unfiltered list when risk_rating is an unrecognized value", async () => {
    searchParams = new URLSearchParams("risk_rating=BOGUS");
    const calls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(mockSuppliers)), { status: 200 }));
    }) as typeof fetch;

    renderWithProviders(<SuppliersPage />);
    await waitFor(() => expect(screen.getByText("Green Farm Co")).toBeInTheDocument());
    expect(calls.some((url) => url.includes("risk_rating="))).toBe(false);
    expect((screen.getByLabelText(/Risk rating/i) as HTMLSelectElement).value).toBe("");
  });
});
