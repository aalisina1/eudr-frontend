import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoLotsTable } from "@/components/sourcing/po-lots-table";
import type { LotReadiness } from "@/lib/api/types";

function lot(over: Partial<LotReadiness> = {}): LotReadiness {
  return {
    id: "l1", reference_number: "LOT-1", quantity: "1000.0000", unit: "KG",
    harvest_period_start: null, harvest_period_end: null, plot_count: 1, plots_resolved: true,
    plots_failed_count: 0, plots_pending_count: 0, filed: false, filing_dds_id: null,
    filing_dds_reference: "", ...over,
  };
}

describe("PoLotsTable unassigned CTA", () => {
  it("shows the Assign-to-consignment CTA on the unassigned bucket and passes its lots", async () => {
    const onAssign = vi.fn();
    render(
      <PoLotsTable
        allocatedLabel="x"
        canAssignUnassigned
        onAssignUnassigned={onAssign}
        // one assigned + one unassigned → the __unassigned__ bucket renders
        lots={[lot({ id: "a", shipment_reference: "BL-1" }), lot({ id: "b", shipment_reference: null })]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Assign to consignment/i }));
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign.mock.calls[0][0].map((l: LotReadiness) => l.id)).toEqual(["b"]);
  });

  it("hides the CTA when canAssignUnassigned is false", () => {
    render(
      <PoLotsTable
        allocatedLabel="x"
        lots={[lot({ id: "a", shipment_reference: "BL-1" }), lot({ id: "b", shipment_reference: null })]}
      />
    );
    expect(screen.queryByRole("button", { name: /Assign to consignment/i })).not.toBeInTheDocument();
  });
});
