/**
 * `/plots` reads `?validation_status=` from the URL and seeds the existing
 * client-side status filter (dashboard-redesign-phase1 filtering addendum,
 * Task 7.2) — the dashboard's Tier 4b "Plots failing validation" doorway
 * deep-links here as `/plots?validation_status=FAILED`. `LandPlotMap` (a
 * leaflet wrapper) is stubbed — this file only exercises the list/filter
 * panel this task actually changes.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import PlotsPage from "@/app/(dashboard)/plots/page";
import type { LandPlot } from "@/lib/api/types";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/plots",
  useParams: () => ({}),
  useSearchParams: () => searchParams,
  redirect: vi.fn(),
}));

vi.mock("@/components/map/land-plot-map", () => ({
  LandPlotMap: () => <div data-testid="map-stub" />,
}));

const originalFetch = globalThis.fetch;

function plot(overrides: Partial<LandPlot> = {}): LandPlot {
  return {
    id: "plot-1",
    reference: "PLOT-000001",
    supplier_id: "sup-1",
    country: "Ghana",
    // Empty (not "Ashanti") — the page's country cell renders
    // `{country}{region ? `, ${region}` : ""}`, so a non-empty region would
    // concatenate onto the country text node ("Ghana, Ashanti") and break
    // this file's exact `getByText("Ghana")`/`getByText("Cameroon")`
    // assertions, which only care about country/status filtering, not region.
    region: "",
    area_hectares: 12.5,
    geometry: null,
    geometry_source: "MANUAL_ENTRY",
    accuracy_meters: null,
    collection_date: null,
    validation_status: "FAILED",
    validated_at: null,
    external_id: "PLOT-001",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("/plots — validation_status URL param (dashboard filtered doorway)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
    vi.restoreAllMocks();
  });

  it("pre-selects Failed and shows only FAILED plots when ?validation_status=FAILED is present", async () => {
    searchParams = new URLSearchParams("validation_status=FAILED");
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          mockPaginatedResponse([
            plot({ id: "p-failed", validation_status: "FAILED", country: "Ghana" }),
            plot({ id: "p-passed", validation_status: "PASSED", country: "Cameroon" }),
          ])
        ),
        { status: 200 }
      )
    );
    renderWithProviders(<PlotsPage />);

    await waitFor(() => expect(screen.getByText("Ghana")).toBeInTheDocument());
    expect(screen.queryByText("Cameroon")).not.toBeInTheDocument();
    const select = screen.getByLabelText(/Validation status/i) as HTMLSelectElement;
    expect(select.value).toBe("FAILED");
  });

  it("degrades to the unfiltered list when validation_status is absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          mockPaginatedResponse([
            plot({ id: "p-failed", validation_status: "FAILED", country: "Ghana" }),
            plot({ id: "p-passed", validation_status: "PASSED", country: "Cameroon" }),
          ])
        ),
        { status: 200 }
      )
    );
    renderWithProviders(<PlotsPage />);

    await waitFor(() => expect(screen.getByText("Ghana")).toBeInTheDocument());
    expect(screen.getByText("Cameroon")).toBeInTheDocument();
    const select = screen.getByLabelText(/Validation status/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("degrades to the unfiltered list when validation_status is an unrecognized value", async () => {
    searchParams = new URLSearchParams("validation_status=BOGUS");
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse([plot({ id: "p-failed", validation_status: "FAILED", country: "Ghana" })])),
        { status: 200 }
      )
    );
    renderWithProviders(<PlotsPage />);

    await waitFor(() => expect(screen.getByText("Ghana")).toBeInTheDocument());
    const select = screen.getByLabelText(/Validation status/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });
});
