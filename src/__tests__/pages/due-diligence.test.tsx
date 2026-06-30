import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import DueDiligencePage from "@/app/(dashboard)/due-diligence/page";

const originalFetch = globalThis.fetch;

function makeMockFetch(status: string) {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify(
        mockPaginatedResponse([
          {
            id: "dds1",
            reference_number: "DDS-2026-001",
            status,
            statement_type: "OPERATOR",
            risk_conclusion: null,
            submitted_at: null,
            created_at: "2026-03-01T00:00:00Z",
          },
        ])
      ),
      { status: 200 }
    )
  );
}

describe("DueDiligencePage", () => {
  beforeEach(() => {
    globalThis.fetch = makeMockFetch("DRAFT");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the page title as Submissions (not Due Diligence)", () => {
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Submissions");
    expect(screen.queryByRole("heading", { level: 1, name: /due diligence/i })).toBeNull();
  });

  it("renders the New Statement button", () => {
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByText("New Statement")).toBeInTheDocument();
  });

  it("renders DDS data after loading", async () => {
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      expect(screen.getByText("DDS-2026-001")).toBeInTheDocument();
    });
  });

  it("renders status and type filters", () => {
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
    expect(screen.getByText("All Risk Levels")).toBeInTheDocument();
  });

  it("renders a DRAFT status badge for a DRAFT DDS", async () => {
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      // Filter option always present (1); badge in table row adds another occurrence after data loads.
      const matches = screen.getAllByText("Draft");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders an Approved status badge for an APPROVED DDS", async () => {
    globalThis.fetch = makeMockFetch("APPROVED");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Approved");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders a Rejected status badge for a REJECTED DDS", async () => {
    globalThis.fetch = makeMockFetch("REJECTED");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Rejected");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders a Submitted status badge for a SUBMITTED DDS", async () => {
    globalThis.fetch = makeMockFetch("SUBMITTED");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Submitted");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders a Withdrawn status badge for a WITHDRAWN DDS", async () => {
    globalThis.fetch = makeMockFetch("WITHDRAWN");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Withdrawn");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
