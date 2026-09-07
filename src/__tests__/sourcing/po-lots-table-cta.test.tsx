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

  it("shows the CTA when every lot is unassigned (the __all__ fallback bucket) and passes all lots", async () => {
    const onAssign = vi.fn();
    render(
      <PoLotsTable
        allocatedLabel="x"
        canAssignUnassigned
        onAssignUnassigned={onAssign}
        // no lot has a shipment_reference → groupByShipment's single
        // { key: "__all__", label: null } fallback bucket
        lots={[lot({ id: "a" }), lot({ id: "b" })]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Assign to consignment/i }));
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign.mock.calls[0][0].map((l: LotReadiness) => l.id)).toEqual(["a", "b"]);
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

/** eudr-frontend#132: the table the "Fix" buttons used to scroll to had no
 * edit affordance. Now each row carries one, gated like every other write. */
describe("PoLotsTable per-row Edit (#132)", () => {
  it("renders an Edit per lot when canEdit and raises the lot id", async () => {
    const onEditLot = vi.fn();
    render(
      <PoLotsTable allocatedLabel="x" canEdit onEditLot={onEditLot} lots={[lot({ id: "a" }), lot({ id: "b", reference_number: "LOT-2" })]} />
    );
    const edits = screen.getAllByRole("button", { name: /^Edit$/i });
    expect(edits).toHaveLength(2);
    await userEvent.click(edits[1]);
    expect(onEditLot).toHaveBeenCalledWith("b");
  });

  it("renders no Edit at all for VIEWER — absent, not disabled", () => {
    render(<PoLotsTable allocatedLabel="x" canEdit={false} onEditLot={vi.fn()} lots={[lot()]} />);
    expect(screen.queryByRole("button", { name: /^Edit$/i })).toBeNull();
  });
});

/** eudr-frontend#134: from an order, reach the shipment each lot group is on. */
describe("PoLotsTable shipment group links (#134)", () => {
  it("the group header links to the shipment when the backend supplies its id", () => {
    render(
      <PoLotsTable
        allocatedLabel="x"
        lots={[
          lot({ id: "a", shipment_reference: "MSCU-1", consignment_id: "c-1" }),
          lot({ id: "b", shipment_reference: null }),
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "MSCU-1" })).toHaveAttribute("href", "/shipments/c-1");
  });

  it("renders the reference as text, not a dead link, when only the reference is known", () => {
    // Pre-#225 backends send shipment_reference without consignment_id.
    render(<PoLotsTable allocatedLabel="x" lots={[lot({ id: "a", shipment_reference: "MSCU-2" }), lot({ id: "b" })]} />);
    expect(screen.getByText("MSCU-2")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "MSCU-2" })).toBeNull();
  });
});
