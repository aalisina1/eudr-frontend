import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgendaRow } from "@/components/shipments/agenda-row";
import type { ConsignmentRow } from "@/lib/api/types";

function row(over: Partial<ConsignmentRow> = {}): ConsignmentRow {
  return {
    id: "c1", reference: "BL-1", expected_clearance_date: null,
    customs_declaration_reference: "", tracking_number: null,
    t49_request_id: null, latest_eta: null, eta_source: "NONE",
    created_at: "2026-07-01T00:00:00Z", rag: "RED", covered_count: 1, total_count: 3,
    countdown_to: "2026-08-01", ...over,
  };
}

describe("AgendaRow", () => {
  it("renders reference + coverage and a PREP NOW deep-link for a gap when canWrite", () => {
    render(<AgendaRow c={row()} canWrite />);
    expect(screen.getByRole("link", { name: "BL-1" })).toHaveAttribute("href", "/shipments/c1");
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PREP NOW/i }))
      .toHaveAttribute("href", "/due-diligence?consignment=c1");
  });

  it("hides PREP NOW for a VIEWER (not canWrite)", () => {
    render(<AgendaRow c={row()} canWrite={false} />);
    expect(screen.queryByRole("link", { name: /PREP NOW/i })).toBeNull();
  });

  it("hides PREP NOW for a covered (GREEN) row", () => {
    render(<AgendaRow c={row({ rag: "GREEN", covered_count: 3 })} canWrite />);
    expect(screen.queryByRole("link", { name: /PREP NOW/i })).toBeNull();
  });
});
