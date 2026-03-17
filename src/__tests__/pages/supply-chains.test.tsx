import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import SupplyChainsPage from "@/app/(dashboard)/supply-chains/page";

const originalFetch = globalThis.fetch;

describe("SupplyChainsPage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          mockPaginatedResponse([
            {
              id: "b1",
              reference_number: "REF-001",
              status: "CONFIRMED",
              quantity: 500,
              unit: "KG",
              country_of_harvest: "Brazil",
              transaction_date: "2026-03-01",
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
    renderWithProviders(<SupplyChainsPage />);
    expect(screen.getByText("Supply Chain Batches")).toBeInTheDocument();
  });

  it("renders the New Batch button", () => {
    renderWithProviders(<SupplyChainsPage />);
    expect(screen.getByText("New Batch")).toBeInTheDocument();
  });

  it("renders batch data after loading", async () => {
    renderWithProviders(<SupplyChainsPage />);
    await waitFor(() => {
      expect(screen.getByText("REF-001")).toBeInTheDocument();
    });
  });

  it("renders status filter", () => {
    renderWithProviders(<SupplyChainsPage />);
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });
});
