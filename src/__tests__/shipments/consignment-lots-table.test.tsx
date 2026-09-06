import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    render(
      <ConsignmentLotsTable
        lots={[lot({ covered: true, stage: "FILED", covering_dds_id: "dds-9", covering_dds_reference: "DDS-9" })]}
        canWrite={false}
        onCompletePlots={vi.fn()}
      />
    );
    const link = screen.getByRole("link", { name: /DDS-9/ });
    expect(link).toHaveAttribute("href", "/submissions/dds-9");
  });

  it("shows Not covered + a Complete plots action (no dead /plots link) for an uncovered ALLOCATED lot when canWrite", () => {
    const onCompletePlots = vi.fn();
    render(<ConsignmentLotsTable lots={[lot()]} canWrite onCompletePlots={onCompletePlots} />);
    expect(screen.getByText(/Not covered/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Complete plots/i });
    expect(button).not.toHaveAttribute("href");
    // No dead-end navigation to the plot list anywhere in this row.
    expect(screen.queryByRole("link", { name: /Complete plots/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "/plots" })).toBeNull();
  });

  it("invokes onCompletePlots with the lot when the Complete plots action is clicked", async () => {
    const onCompletePlots = vi.fn();
    const uncovered = lot();
    render(<ConsignmentLotsTable lots={[uncovered]} canWrite onCompletePlots={onCompletePlots} />);
    await userEvent.click(screen.getByRole("button", { name: /Complete plots/i }));
    expect(onCompletePlots).toHaveBeenCalledWith(uncovered);
  });

  it("hides the Complete plots action for VIEWER (canWrite=false), even though it's an uncovered ALLOCATED lot", () => {
    render(<ConsignmentLotsTable lots={[lot()]} canWrite={false} onCompletePlots={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Complete plots/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Complete plots/i)).not.toBeInTheDocument();
  });

  it("renders the empty state when there are no lots", () => {
    render(<ConsignmentLotsTable lots={[]} canWrite={false} onCompletePlots={vi.fn()} />);
    expect(screen.getByText(/No lots assigned/i)).toBeInTheDocument();
  });

  it("falls back to covering_dds_id when covering_dds_reference is empty", () => {
    render(
      <ConsignmentLotsTable
        lots={[lot({ covered: true, covering_dds_id: "dds-42", covering_dds_reference: "" })]}
        canWrite={false}
        onCompletePlots={vi.fn()}
      />
    );
    const link = screen.getByRole("link", { name: /dds-42/ });
    expect(link).toHaveAttribute("href", "/submissions/dds-42");
  });

  it("shows Not covered but no resolve action for an uncovered PLOTS_COMPLETE lot", () => {
    render(
      <ConsignmentLotsTable lots={[lot({ stage: "PLOTS_COMPLETE", covered: false })]} canWrite onCompletePlots={vi.fn()} />
    );
    expect(screen.getByText(/Not covered/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Complete plots/i })).toBeNull();
  });
});
