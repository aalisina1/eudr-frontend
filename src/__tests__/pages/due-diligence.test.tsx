import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import DueDiligencePage from "@/app/(dashboard)/due-diligence/page";

const originalFetch = globalThis.fetch;

describe("DueDiligencePage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          mockPaginatedResponse([
            {
              id: "dds1",
              reference_number: "DDS-2026-001",
              status: "DRAFT",
              statement_type: "OPERATOR",
              risk_conclusion: null,
              created_at: "2026-03-01T00:00:00Z",
            },
          ])
        ),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the page title", () => {
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByText("Due Diligence")).toBeInTheDocument();
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
});
