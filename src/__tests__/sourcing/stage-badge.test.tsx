import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageBadge, STAGE_FILTER_OPTIONS, STAGE_LABELS } from "@/components/sourcing/stage-badge";

describe("StageBadge", () => {
  it.each([
    ["OPEN", "Open"],
    ["ALLOCATED", "Allocated"],
    ["PLOTS_COMPLETE", "Plots complete"],
    ["READY", "Ready to file"],
    ["FILED", "Filed"],
  ] as const)("renders the %s stage as %s", (stage, label) => {
    render(<StageBadge stage={stage} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("the Blocked overlay wins over the underlying stage (they're independent — PR #83)", () => {
    render(<StageBadge stage="READY" blocked />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Ready to file")).not.toBeInTheDocument();
  });

  it("is not blocked by default", () => {
    render(<StageBadge stage="ALLOCATED" />);
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("STAGE_LABELS covers every ReadinessStage value", () => {
    expect(Object.keys(STAGE_LABELS).sort()).toEqual(
      ["ALLOCATED", "FILED", "OPEN", "PLOTS_COMPLETE", "READY"].sort()
    );
  });

  it("STAGE_FILTER_OPTIONS is the single unified 7-option list (All stages + 5 stages + Blocked)", () => {
    expect(STAGE_FILTER_OPTIONS.map((o) => o.label)).toEqual([
      "All stages",
      "Open",
      "Allocated",
      "Plots complete",
      "Ready to file",
      "Filed",
      "Blocked",
    ]);
  });
});
