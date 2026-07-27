import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { AssignPlotsSheet } from "@/components/shipments/assign-plots-sheet";
import type { Batch, LandPlot } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function batch(over: Partial<Batch> = {}): Batch {
  return {
    id: "lot-1", seller_id: "s1", buyer_id: "b1", product_id: "p1", quantity: 1000,
    unit: "KG", transaction_date: "2026-01-01", country_of_harvest: "GH",
    harvest_period_start: null, harvest_period_end: null, shipment_reference: null,
    expected_clearance_date: null, fulfils_reference: null, land_plot_ids: [],
    reference_number: "LOT-1", status: "CONFIRMED", external_id: "", created_at: "",
    updated_at: "", ...over,
  };
}

function plot(over: Partial<LandPlot> = {}): LandPlot {
  return {
    id: "plot-a", supplier_id: "sup-1", organization_id: "org-1", country: "Ghana",
    region: "Ashanti", area_hectares: 4.2, geometry: null, geometry_source: "GPS_DEVICE",
    accuracy_meters: null, collection_date: null, validation_status: "PASSED",
    validated_at: null, external_id: "PLOT-A", created_at: "", updated_at: "", ...over,
  };
}

function mockFetch(handlers: {
  batch?: Batch;
  plots?: LandPlot[];
  patchStatus?: number;
  patchBody?: unknown;
}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const b = handlers.batch ?? batch();
  const plots = handlers.plots ?? [plot()];
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    if (init?.method === "PATCH" && url.includes(`/supply-chain/batches/${b.id}/`)) {
      return Promise.resolve(
        new Response(JSON.stringify(handlers.patchBody ?? { ...b }), { status: handlers.patchStatus ?? 200 })
      );
    }
    if (url.includes("/geolocation/plots/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(plots)), { status: 200 }));
    }
    if (url.includes(`/supply-chain/batches/${b.id}/`)) {
      return Promise.resolve(new Response(JSON.stringify(b), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
  return calls;
}

describe("AssignPlotsSheet", () => {
  it("pre-checks the lot's currently assigned plots once loaded", async () => {
    mockFetch({
      batch: batch({ land_plot_ids: ["plot-a"] }),
      plots: [plot({ id: "plot-a", external_id: "PLOT-A" }), plot({ id: "plot-b", external_id: "PLOT-B" })],
    });
    renderWithProviders(
      <AssignPlotsSheet open onOpenChange={vi.fn()} lotId="lot-1" />
    );

    await waitFor(() => expect(screen.getByText("PLOT-A")).toBeInTheDocument());
    const checkboxA = screen.getByRole("checkbox", { name: /PLOT-A/i });
    const checkboxB = screen.getByRole("checkbox", { name: /PLOT-B/i });
    await waitFor(() => expect(checkboxA).toHaveAttribute("aria-checked", "true"));
    expect(checkboxB).toHaveAttribute("aria-checked", "false");
  });

  it("surfaces each plot's validation status so a FAILED plot is visible", async () => {
    mockFetch({
      batch: batch({ land_plot_ids: [] }),
      plots: [plot({ id: "plot-c", external_id: "PLOT-C", validation_status: "FAILED" })],
    });
    renderWithProviders(<AssignPlotsSheet open onOpenChange={vi.fn()} lotId="lot-1" />);

    await waitFor(() => expect(screen.getByText("PLOT-C")).toBeInTheDocument());
    expect(screen.getByText("FAILED")).toBeInTheDocument();
  });

  it("PATCHes the full selected land_plot_ids array on save and closes", async () => {
    const calls = mockFetch({
      batch: batch({ land_plot_ids: ["plot-a"] }),
      plots: [plot({ id: "plot-a", external_id: "PLOT-A" }), plot({ id: "plot-b", external_id: "PLOT-B" })],
    });
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    renderWithProviders(
      <AssignPlotsSheet open onOpenChange={onOpenChange} lotId="lot-1" onSaved={onSaved} />
    );

    await waitFor(() => expect(screen.getByRole("checkbox", { name: /PLOT-A/i })).toHaveAttribute("aria-checked", "true"));
    await userEvent.click(screen.getByRole("checkbox", { name: /PLOT-B/i }));
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Save/i })); });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSaved).toHaveBeenCalled();
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(patch?.url).toContain("/api/v1/supply-chain/batches/lot-1/");
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ land_plot_ids: ["plot-a", "plot-b"] });
  });

  it("deselecting every pre-checked plot clears land_plot_ids on save (whole-array replace)", async () => {
    const calls = mockFetch({
      batch: batch({ land_plot_ids: ["plot-a"] }),
      plots: [plot({ id: "plot-a", external_id: "PLOT-A" })],
    });
    renderWithProviders(
      <AssignPlotsSheet open onOpenChange={vi.fn()} lotId="lot-1" />
    );

    const checkboxA = await screen.findByRole("checkbox", { name: /PLOT-A/i });
    await waitFor(() => expect(checkboxA).toHaveAttribute("aria-checked", "true"));
    await userEvent.click(checkboxA);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Save/i })); });

    await waitFor(() => {
      const patch = calls.find((c) => c.init?.method === "PATCH");
      expect(patch).toBeDefined();
      expect(JSON.parse(String(patch?.init?.body))).toEqual({ land_plot_ids: [] });
    });
  });

  it("searches the org's plots via the geolocation endpoint", async () => {
    mockFetch({ plots: [plot({ id: "plot-a", external_id: "PLOT-A" })] });
    renderWithProviders(<AssignPlotsSheet open onOpenChange={vi.fn()} lotId="lot-1" />);
    await waitFor(() => expect(screen.getByText("PLOT-A")).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText(/search/i), "ghana");
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/geolocation/plots/"),
        expect.anything()
      )
    );
    const searchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .map(([u]) => (typeof u === "string" ? u : u.toString()))
      .find((u: string) => u.includes("search=ghana"));
    expect(searchCall).toBeDefined();
  });
});
