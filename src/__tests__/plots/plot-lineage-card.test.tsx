import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { PlotLineageCard } from "@/components/plots/plot-lineage-card";
import type { PlotLineageLot } from "@/lib/api/types";

/**
 * eudr-frontend#134. From a plot, reach the lots that use it, the orders
 * they fulfil, the shipments carrying them and the statements covering them —
 * without going through a list. The direction nothing offered.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function lot(over: Partial<PlotLineageLot> = {}): PlotLineageLot {
  return {
    id: "lot-1", reference_number: "LOT-GH-26-0871", quantity: "25000.0000", unit: "KG",
    po_id: "po-1", po_reference: "PO-2026-0141", consignment_id: "c-1",
    consignment_reference: "MSCU-884210", covering_dds_id: "dds-1",
    covering_dds_reference: "DDS-2026-GH-010", ...over,
  };
}

function mockLineage(lots: PlotLineageLot[], status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ lots }), { status, headers: { "Content-Type": "application/json" } })
  );
}

describe("PlotLineageCard", () => {
  it("links every hop of the chain for a fully resolved lot", async () => {
    mockLineage([lot()]);
    renderWithProviders(<PlotLineageCard plotId="plot-1" />);
    expect(await screen.findByRole("link", { name: "LOT-GH-26-0871" })).toHaveAttribute("href", "/sourcing/po-1#lots");
    expect(screen.getByRole("link", { name: "PO-2026-0141" })).toHaveAttribute("href", "/sourcing/po-1");
    expect(screen.getByRole("link", { name: "MSCU-884210" })).toHaveAttribute("href", "/shipments/c-1");
    expect(screen.getByRole("link", { name: "DDS-2026-GH-010" })).toHaveAttribute("href", "/submissions/dds-1");
  });

  it("renders a plain marker, not a dead link, for each absent hop", async () => {
    mockLineage([lot({ po_id: null, po_reference: "", consignment_id: null, consignment_reference: "", covering_dds_id: null, covering_dds_reference: "" })]);
    renderWithProviders(<PlotLineageCard plotId="plot-1" />);
    await screen.findByText("LOT-GH-26-0871");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText(/no order/i)).toBeInTheDocument();
    expect(screen.getByText(/not shipped/i)).toBeInTheDocument();
    expect(screen.getByText(/not filed/i)).toBeInTheDocument();
  });

  it("says so plainly when no lot uses the plot", async () => {
    mockLineage([]);
    renderWithProviders(<PlotLineageCard plotId="plot-1" />);
    expect(await screen.findByText(/no lot uses this plot yet/i)).toBeInTheDocument();
  });

  it("distinguishes a failed load from an empty chain", async () => {
    mockLineage([], 500);
    renderWithProviders(<PlotLineageCard plotId="plot-1" />);
    expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
    expect(screen.queryByText(/no lot uses this plot/i)).toBeNull();
  });
});
