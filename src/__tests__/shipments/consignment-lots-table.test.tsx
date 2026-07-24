import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsignmentLotsTable } from "@/components/shipments/consignment-lots-table";
import type { ConsignmentLot } from "@/lib/api/types";

function lot(over: Partial<ConsignmentLot> = {}): ConsignmentLot {
  return {
    id: "l1", reference_number: "LOT-1", quantity: "1000.0000", unit: "KG",
    stage: "ALLOCATED", covered: false, covering_dds_id: null, covering_dds_reference: "", ...over,
  };
}

describe("ConsignmentLotsTable", () => {
  it("links a covered lot to its covering DDS", () => {
    render(<ConsignmentLotsTable lots={[lot({ covered: true, stage: "FILED", covering_dds_id: "dds-9", covering_dds_reference: "DDS-9" })]} />);
    const link = screen.getByRole("link", { name: /DDS-9/ });
    expect(link).toHaveAttribute("href", "/due-diligence/dds-9");
  });

  it("shows Not covered + a resolve link for an uncovered ALLOCATED lot", () => {
    render(<ConsignmentLotsTable lots={[lot()]} />);
    expect(screen.getByText(/Not covered/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Complete plots/i })).toHaveAttribute("href", "/plots");
  });

  it("renders the empty state when there are no lots", () => {
    render(<ConsignmentLotsTable lots={[]} />);
    expect(screen.getByText(/No lots assigned/i)).toBeInTheDocument();
  });

  it("falls back to covering_dds_id when covering_dds_reference is empty", () => {
    render(<ConsignmentLotsTable lots={[lot({ covered: true, covering_dds_id: "dds-42", covering_dds_reference: "" })]} />);
    const link = screen.getByRole("link", { name: /dds-42/ });
    expect(link).toHaveAttribute("href", "/due-diligence/dds-42");
  });

  it("shows Not covered but no resolve link for an uncovered PLOTS_COMPLETE lot", () => {
    render(<ConsignmentLotsTable lots={[lot({ stage: "PLOTS_COMPLETE", covered: false })]} />);
    expect(screen.getByText(/Not covered/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Complete plots/i })).toBeNull();
  });
});
