import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadinessChecklistCard } from "@/components/sourcing/readiness-checklist-card";
import type { LotReadiness, ReadinessBlocker } from "@/lib/api/types";

function blocker(over: Partial<ReadinessBlocker> = {}): ReadinessBlocker {
  return { code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3, ...over };
}

function lot(over: Partial<LotReadiness> = {}): LotReadiness {
  return {
    id: "lot-1", reference_number: "LOT-1", quantity: "1000.0000", unit: "KG",
    harvest_period_start: null, harvest_period_end: null, plot_count: 5,
    plots_resolved: false, plots_failed_count: 0, plots_pending_count: 0,
    filed: false, filing_dds_id: null, filing_dds_reference: "", ...over,
  };
}

describe("ReadinessChecklistCard", () => {
  it("shows the all-clear row when there are no blockers", () => {
    render(<ReadinessChecklistCard blockers={[]} lots={[]} canWrite onAssignPlots={vi.fn()} />);
    expect(screen.getByText(/ready to file/i)).toBeInTheDocument();
  });

  it("opens the assign-plots flow (no /plots link) for PLOTS_FAILED_VALIDATION when canWrite", async () => {
    const onAssignPlots = vi.fn();
    render(
      <ReadinessChecklistCard
        blockers={[blocker({ code: "PLOTS_FAILED_VALIDATION" })]}
        lots={[lot({ id: "lot-failed", plots_failed_count: 3 })]}
        canWrite
        onAssignPlots={onAssignPlots}
      />
    );
    const btn = screen.getByRole("button", { name: /Review plots/i });
    expect(btn).not.toHaveAttribute("href");
    await userEvent.click(btn);
    expect(onAssignPlots).toHaveBeenCalledWith("lot-failed");
    expect(screen.queryByRole("link", { name: /Review plots/i })).toBeNull();
  });

  it("targets the lot with pending plots for PLOTS_PENDING_VALIDATION", async () => {
    const onAssignPlots = vi.fn();
    render(
      <ReadinessChecklistCard
        blockers={[blocker({ code: "PLOTS_PENDING_VALIDATION", message: "2 plots pending validation" })]}
        lots={[
          lot({ id: "lot-clean" }),
          lot({ id: "lot-pending", plots_pending_count: 2 }),
        ]}
        canWrite
        onAssignPlots={onAssignPlots}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Review plots/i }));
    expect(onAssignPlots).toHaveBeenCalledWith("lot-pending");
  });

  it("hides the Review plots action for VIEWER (canWrite=false)", () => {
    render(
      <ReadinessChecklistCard
        blockers={[blocker({ code: "PLOTS_FAILED_VALIDATION" })]}
        lots={[lot({ id: "lot-failed", plots_failed_count: 3 })]}
        canWrite={false}
        onAssignPlots={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Review plots/i })).not.toBeInTheDocument();
    // The message itself still surfaces — only the write action is gated.
    expect(screen.getByText("3 plots failed deforestation validation")).toBeInTheDocument();
  });

  it("renders no action when no lot matches the blocker (avoids a dead click)", () => {
    render(
      <ReadinessChecklistCard
        blockers={[blocker({ code: "PLOTS_FAILED_VALIDATION" })]}
        lots={[lot({ id: "lot-clean" })]}
        canWrite
        onAssignPlots={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Review plots/i })).not.toBeInTheDocument();
  });

  it("leaves unrelated blocker codes as plain scroll/nav actions, unaffected by canWrite", async () => {
    render(
      <ReadinessChecklistCard
        blockers={[blocker({ code: "OPERATOR_IDENTITY_INCOMPLETE", message: "Operator profile incomplete" })]}
        lots={[]}
        canWrite={false}
        onAssignPlots={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /Complete profile/i });
    await userEvent.click(btn); // routes via the mocked useRouter — should not throw
    expect(btn).toBeInTheDocument();
  });
});

/**
 * eudr-frontend#132: four of nine blocker codes pointed a "Fix" button at
 * `#lots`, a read-only table. Each fixable code must land on a control that
 * can change the field it names. `MISSING_GEOLOCATION` is an assign-plots
 * action (the machinery already existed); the harvest and unit blockers open
 * the new edit-lot sheet on the lot that actually has the defect.
 */
describe("ReadinessChecklistCard — fix paths (#132)", () => {
  const base = { canWrite: true, poUnit: "KG" as const };

  it("MISSING_HARVEST_PERIOD opens edit-lot on the first lot with no harvest period", async () => {
    const onEditLot = vi.fn();
    render(
      <ReadinessChecklistCard
        {...base}
        blockers={[blocker({ code: "MISSING_HARVEST_PERIOD", message: "1 lot missing harvest period" })]}
        lots={[
          lot({ id: "lot-ok", harvest_period_start: "2026-03-01", harvest_period_end: "2026-04-01" }),
          lot({ id: "lot-missing" }),
        ]}
        onAssignPlots={vi.fn()}
        onEditLot={onEditLot}
      />
    );
    const btn = screen.getByRole("button", { name: /Fix/i });
    expect(btn).not.toHaveAttribute("href");
    await userEvent.click(btn);
    expect(onEditLot).toHaveBeenCalledWith("lot-missing");
  });

  it("MISSING_GEOLOCATION opens assign-plots on the first lot with no plots", async () => {
    const onAssignPlots = vi.fn();
    render(
      <ReadinessChecklistCard
        {...base}
        blockers={[blocker({ code: "MISSING_GEOLOCATION", message: "1 lot has no plots" })]}
        lots={[lot({ id: "lot-has-plots", plot_count: 3 }), lot({ id: "lot-no-plots", plot_count: 0 })]}
        onAssignPlots={onAssignPlots}
        onEditLot={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Add plots/i }));
    expect(onAssignPlots).toHaveBeenCalledWith("lot-no-plots");
  });

  it("UNIT_MISMATCH opens edit-lot on the first lot whose unit differs from the PO's", async () => {
    const onEditLot = vi.fn();
    render(
      <ReadinessChecklistCard
        {...base}
        blockers={[blocker({ code: "UNIT_MISMATCH", message: "Lot unit differs from order" })]}
        lots={[lot({ id: "lot-kg", unit: "KG" }), lot({ id: "lot-tonnes", unit: "TONNES" })]}
        onAssignPlots={vi.fn()}
        onEditLot={onEditLot}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Fix unit/i }));
    expect(onEditLot).toHaveBeenCalledWith("lot-tonnes");
  });

  it("OVER_ALLOCATED has no single target lot, so it still scrolls to the (now editable) table", () => {
    render(
      <ReadinessChecklistCard
        {...base}
        blockers={[blocker({ code: "OVER_ALLOCATED", message: "Lots exceed ordered quantity" })]}
        lots={[lot()]}
        onAssignPlots={vi.fn()}
        onEditLot={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /View lots/i })).toBeInTheDocument();
  });

  it("renders no fix button when no lot actually has the defect", () => {
    // A button that goes nowhere is the defect being fixed. If every lot has
    // a harvest period, the blocker is stale and the row is informational.
    render(
      <ReadinessChecklistCard
        {...base}
        blockers={[blocker({ code: "MISSING_HARVEST_PERIOD" })]}
        lots={[lot({ harvest_period_start: "2026-03-01", harvest_period_end: "2026-04-01" })]}
        onAssignPlots={vi.fn()}
        onEditLot={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Fix/i })).toBeNull();
  });

  it("hides the edit-lot actions for VIEWER, absent from the DOM not disabled", () => {
    render(
      <ReadinessChecklistCard
        {...base}
        canWrite={false}
        blockers={[
          blocker({ code: "MISSING_HARVEST_PERIOD" }),
          blocker({ code: "UNIT_MISMATCH" }),
          blocker({ code: "MISSING_GEOLOCATION" }),
        ]}
        lots={[lot({ id: "l", unit: "TONNES", plot_count: 0 })]}
        onAssignPlots={vi.fn()}
        onEditLot={vi.fn()}
      />
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
