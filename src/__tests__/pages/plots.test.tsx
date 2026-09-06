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
    // Empty (not "Ashanti") — kept simple. Since ADR-0026 the card title is
    // the plot's `reference`; country/region now only appear in the
    // secondary context line (via `plotIdentity`), so this file matches on
    // country with a substring regex rather than an exact `getByText` on
    // the (no longer country-based) title.
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
            plot({ id: "p-failed", reference: "PLOT-000001", validation_status: "FAILED", country: "Ghana" }),
            plot({ id: "p-passed", reference: "PLOT-000002", validation_status: "PASSED", country: "Cameroon" }),
          ])
        ),
        { status: 200 }
      )
    );
    renderWithProviders(<PlotsPage />);

    await waitFor(() => expect(screen.getByText(/Ghana/)).toBeInTheDocument());
    expect(screen.queryByText(/Cameroon/)).not.toBeInTheDocument();
    const select = screen.getByLabelText(/Validation status/i) as HTMLSelectElement;
    expect(select.value).toBe("FAILED");
  });

  it("degrades to the unfiltered list when validation_status is absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          mockPaginatedResponse([
            plot({ id: "p-failed", reference: "PLOT-000001", validation_status: "FAILED", country: "Ghana" }),
            plot({ id: "p-passed", reference: "PLOT-000002", validation_status: "PASSED", country: "Cameroon" }),
          ])
        ),
        { status: 200 }
      )
    );
    renderWithProviders(<PlotsPage />);

    await waitFor(() => expect(screen.getByText(/Ghana/)).toBeInTheDocument());
    expect(screen.getByText(/Cameroon/)).toBeInTheDocument();
    const select = screen.getByLabelText(/Validation status/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("degrades to the unfiltered list when validation_status is an unrecognized value", async () => {
    searchParams = new URLSearchParams("validation_status=BOGUS");
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse([plot({ id: "p-failed", reference: "PLOT-000001", validation_status: "FAILED", country: "Ghana" })])),
        { status: 200 }
      )
    );
    renderWithProviders(<PlotsPage />);

    await waitFor(() => expect(screen.getByText(/Ghana/)).toBeInTheDocument());
    const select = screen.getByLabelText(/Validation status/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });
});

/**
 * eudr-frontend#133: clicking a plot card only highlighted it on the map.
 * There was no path from the list to `/plots/[id]` at all — the detail page
 * was reachable only through a DDS. Decision: the card still selects (the
 * map is the point of the list, and navigating on click would make it
 * useless), and every card carries a distinct, keyboard-reachable Open link.
 */
describe("/plots — reaching plot detail (#133)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
    vi.restoreAllMocks();
  });

  function seed(plots: LandPlot[]) {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockPaginatedResponse(plots)), { status: 200 })
    );
  }

  it("every card has an Open link to its detail page", async () => {
    seed([plot({ id: "p-1", reference: "PLOT-000001" }), plot({ id: "p-2", reference: "PLOT-000002" })]);
    renderWithProviders(<PlotsPage />);
    const links = await screen.findAllByRole("link", { name: /Open plot PLOT-00000[12]/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/plots/p-1");
    expect(links[1]).toHaveAttribute("href", "/plots/p-2");
  });

  it("the card itself is keyboard-selectable and selection does not navigate", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    seed([plot({ id: "p-1", reference: "PLOT-000001" })]);
    renderWithProviders(<PlotsPage />);
    const card = await screen.findByRole("button", { name: /PLOT-000001/ });
    expect(card).toHaveAttribute("aria-pressed", "false");
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(card).toHaveAttribute("aria-pressed", "true");
  });

  it("filters to one supplier from ?supplier_id=, so other screens can deep-link here with context", async () => {
    searchParams = new URLSearchParams("supplier_id=sup-A");
    seed([
      plot({ id: "p-a", reference: "PLOT-00000A", supplier_id: "sup-A" }),
      plot({ id: "p-b", reference: "PLOT-00000B", supplier_id: "sup-B" }),
    ]);
    renderWithProviders(<PlotsPage />);
    await screen.findByText(/PLOT-00000A/);
    expect(screen.queryByText(/PLOT-00000B/)).toBeNull();
    expect(screen.getByText(/1 of 2 plots/)).toBeInTheDocument();
  });
});
