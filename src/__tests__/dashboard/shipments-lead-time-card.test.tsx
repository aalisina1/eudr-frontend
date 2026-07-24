import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { ShipmentsLeadTimeCard } from "@/components/dashboard/shipments-lead-time-card";
import type { ConsignmentSummary } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function mockSummary(s: ConsignmentSummary) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/consignments/summary/"))
      return Promise.resolve(new Response(JSON.stringify(s), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
}

describe("ShipmentsLeadTimeCard", () => {
  it("shows the headline count and links to the pre-filtered list", async () => {
    mockSummary({ red: 3, amber: 2, gray: 1, green: 5, landing_within_red_window_uncovered: 3 });
    await act(async () => { renderWithProviders(<ShipmentsLeadTimeCard />); });
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    expect(screen.getByText(/land within 10 days with incomplete DDS/i)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/shipments?rag=RED");
    expect(screen.getByText(/2 Amber/)).toBeInTheDocument();
    expect(screen.getByText(/5 Green/)).toBeInTheDocument();
  });
});
