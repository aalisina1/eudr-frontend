import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeadlineChip } from "@/components/sourcing/deadline-chip";

describe("DeadlineChip", () => {
  it("renders the muted placeholder when no eta/days are given (BE-B #61 not shipped)", () => {
    render(<DeadlineChip />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders muted tone for a deadline more than 14 days out", () => {
    render(<DeadlineChip etaLabel="14 Aug" days={37} />);
    const chip = screen.getByText(/ETA 14 Aug/).closest("[data-slot=\"deadline-chip\"]");
    expect(chip?.className).toContain("text-muted-foreground");
  });

  it("renders the accent (copper) tone for a deadline within 14 days", () => {
    render(<DeadlineChip etaLabel="20 Jul" days={12} />);
    const chip = screen.getByText(/ETA 20 Jul/).closest("[data-slot=\"deadline-chip\"]");
    expect(chip?.className).toContain("text-accent");
  });

  it("renders the destructive tone within 5 days", () => {
    render(<DeadlineChip etaLabel="11 Jul" days={3} />);
    const chip = screen.getByText(/ETA 11 Jul/).closest("[data-slot=\"deadline-chip\"]");
    expect(chip?.className).toContain("text-destructive");
  });

  it("renders the destructive tone and 'overdue' copy when days is negative", () => {
    render(<DeadlineChip etaLabel="1 Jul" days={-2} />);
    expect(screen.getByText(/2 d overdue/)).toBeInTheDocument();
  });
});
