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
