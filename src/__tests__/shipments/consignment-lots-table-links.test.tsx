import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsignmentLotsTable } from "@/components/shipments/consignment-lots-table";
import type { ConsignmentLot } from "@/lib/api/types";

/** eudr-frontend#134: from a shipment, reach the order each lot fulfils and
 * the plots it traces to. */
function lot(over: Partial<ConsignmentLot> = {}): ConsignmentLot {
  return {
    id: "l1", reference_number: "LOT-1", quantity: "1000.0000", unit: "KG", stage: "ALLOCATED",
    covered: false, covering_dds_id: null, covering_dds_reference: "", ...over,
  };
}

describe("ConsignmentLotsTable cross-links (#134)", () => {
  it("links each lot to its order and shows how many plots it traces to", () => {
    render(
      <ConsignmentLotsTable
        canWrite={false}
        onCompletePlots={vi.fn()}
        lots={[lot({ po_id: "po-9", po_reference: "PO-2026-0009", plot_ids: ["p1", "p2", "p3"] })]}
      />
    );
    expect(screen.getByRole("link", { name: "PO-2026-0009" })).toHaveAttribute("href", "/sourcing/po-9");
    expect(screen.getByText(/3 plots/)).toBeInTheDocument();
  });

  it("marks a lot with no order plainly, and never emits a dead link", () => {
    render(<ConsignmentLotsTable canWrite={false} onCompletePlots={vi.fn()} lots={[lot({ po_id: null, po_reference: "", plot_ids: [] })]} />);
    expect(screen.getByText(/no order/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
