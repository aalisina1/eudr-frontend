import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import DashboardPage from "@/app/(dashboard)/dashboard/page";

const originalFetch = globalThis.fetch;

describe("DashboardPage", () => {
  beforeEach(() => {
    // Mock all the stat + chart fetch calls
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("/suppliers/")) {
        return new Response(
          JSON.stringify(mockPaginatedResponse([{ id: "s1" }], 12)),
          { status: 200 }
        );
      }
      if (urlStr.includes("/geolocation/plots/")) {
        return new Response(
          JSON.stringify(
            mockPaginatedResponse(
              [
                {
                  id: "p1",
                  validation_status: "PASSED",
                  area_hectares: 10,
                },
              ],
              45
            )
          ),
          { status: 200 }
        );
      }
      if (urlStr.includes("/supply-chain/batches/")) {
        return new Response(
          JSON.stringify(mockPaginatedResponse([{ id: "b1" }], 89)),
          { status: 200 }
        );
      }
      if (urlStr.includes("/due-diligence/statements/")) {
        return new Response(
          JSON.stringify(
            mockPaginatedResponse(
              [{ id: "d1", status: "DRAFT" }],
              23
            )
          ),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify(mockPaginatedResponse([])), {
        status: 200,
      });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders stat cards", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Suppliers")).toBeInTheDocument();
    });
    expect(screen.getByText("Land Plots")).toBeInTheDocument();
    expect(screen.getByText("Batches")).toBeInTheDocument();
    expect(screen.getByText("Statements")).toBeInTheDocument();
  });

  it("renders stat descriptions", async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("Registered partners")).toBeInTheDocument();
    });
  });

  it("displays counts after loading", async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });

  it("renders chart sections", async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Due Diligence by Status")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Plot Validation Status")).toBeInTheDocument();
  });
});
