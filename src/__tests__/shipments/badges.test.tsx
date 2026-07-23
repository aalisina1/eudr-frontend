import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RagBadge } from "@/components/shipments/rag-badge";
import { TrackingBadge } from "@/components/shipments/tracking-badge";

describe("RagBadge", () => {
  it("bakes the countdown into RED", () => {
    render(<RagBadge rag="RED" countdownDays={4} countdownLabel="24 Jul" />);
    expect(screen.getByText(/RED · 4 d/)).toBeInTheDocument();
  });
  it("shows AMBER with its day count", () => {
    render(<RagBadge rag="AMBER" countdownDays={12} />);
    expect(screen.getByText(/AMBER · 12 d/)).toBeInTheDocument();
  });
  it("renders GREEN as Covered (no day suffix)", () => {
    render(<RagBadge rag="GREEN" />);
    expect(screen.getByText(/Covered/)).toBeInTheDocument();
  });
  it("renders GRAY as No date", () => {
    render(<RagBadge rag="GRAY" countdownDays={null} />);
    expect(screen.getByText(/No date/)).toBeInTheDocument();
  });
});

describe("TrackingBadge", () => {
  it.each([
    ["untracked", /Not tracked/],
    ["subscribing", /Subscribing/],
    ["live", /Live/],
    ["error", /Tracking error/],
    ["quota_reached", /Quota reached/],
  ] as const)("renders %s copy", (state, re) => {
    render(<TrackingBadge state={state} />);
    expect(screen.getByText(re)).toBeInTheDocument();
  });
});
