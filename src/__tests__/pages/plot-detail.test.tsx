/**
 * Regression guard for the plot detail page (ADR-0026). The header renders
 * only `plotIdentity(plot).primary` (the plot's `reference`) and never
 * `.secondary`, and the details grid has no country/region cells of its own —
 * country of production is a regulated EUDR attribute, so it must be readable
 * on this page without having to interpret the map geometry. See
 * `src/lib/plot-identity.ts` and the details grid in
 * `src/app/(dashboard)/plots/[id]/page.tsx`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { Suspense } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import PlotDetailPage from "@/app/(dashboard)/plots/[id]/page";
import type { LandPlot } from "@/lib/api/types";

vi.mock("@/components/map/land-plot-map", () => ({
  LandPlotMap: () => <div data-testid="map-stub" />,
}));

const originalFetch = globalThis.fetch;

function plot(overrides: Partial<LandPlot> = {}): LandPlot {
  return {
    id: "plot-1",
    reference: "PLOT-000412",
    supplier_id: "sup-1",
    country: "Ghana",
    region: "Ashanti",
    area_hectares: 12.5,
    geometry: null,
    geometry_source: "MANUAL_ENTRY",
    accuracy_meters: null,
    collection_date: null,
    validation_status: "PASSED",
    validated_at: null,
    external_id: "PLOT-001",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Pre-resolve the `params` thenable via React's "fulfilled thenable" fast
 * path (see supplier-detail.test.tsx for the full rationale) — the App
 * Router's `use(params)` convention otherwise suspends on first render and
 * doesn't reliably flush in this jsdom/Vitest harness. */
function resolvedParams(id: string) {
  const p = Promise.resolve({ id }) as Promise<{ id: string }> & { status?: string; value?: unknown };
  p.status = "fulfilled";
  p.value = { id };
  return p;
}

function renderPage(id = "plot-1") {
  return renderWithProviders(
    <Suspense fallback={<div data-testid="page-suspense-fallback" />}>
      <PlotDetailPage params={resolvedParams(id)} />
    </Suspense>
  );
}

function mockFetchOnce(data: LandPlot) {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
}

describe("PlotDetailPage", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows the plot's reference as the heading", async () => {
    mockFetchOnce(plot({ reference: "PLOT-000412" }));
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("PLOT-000412")
    );
  });

  it("shows both country and region on the page (regression guard)", async () => {
    mockFetchOnce(plot({ country: "Ghana", region: "Ashanti" }));
    renderPage();

    await waitFor(() => expect(screen.getByText("Ghana")).toBeInTheDocument());
    expect(screen.getByText("Ashanti")).toBeInTheDocument();
  });

  it("degrades a blank region to an em dash, not a stray separator or 'undefined'", async () => {
    mockFetchOnce(plot({ country: "Ghana", region: "" }));
    renderPage();

    await waitFor(() => expect(screen.getByText("Ghana")).toBeInTheDocument());
    const regionLabel = screen.getByText("Region");
    const regionValue = regionLabel.nextElementSibling;
    expect(regionValue).not.toBeNull();
    expect(regionValue?.textContent).toBe("—");
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });
});
