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

function mockSummaryError() {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/consignments/summary/"))
      return Promise.resolve(new Response("Internal Server Error", { status: 500 }));
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
}

function mockSummaryNeverResolves() {
  globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) as typeof fetch;
}

describe("ShipmentsLeadTimeCard", () => {
  it("shows the headline count and links to the pre-filtered list", async () => {
    mockSummary({ red: 4, amber: 2, gray: 1, green: 5, landing_within_red_window_uncovered: 3 });
    await act(async () => { renderWithProviders(<ShipmentsLeadTimeCard />); });
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/shipments?rag=RED");
    expect(link.textContent).toMatch(/consignments/);
    expect(link.textContent).toMatch(/land within 10 days with incomplete DDS/);
    expect(screen.getByText(/4 Red/)).toBeInTheDocument();
    expect(screen.getByText(/1 Gray/)).toBeInTheDocument();
  });

  it("uses singular verb and noun form when count is 1", async () => {
    mockSummary({ red: 0, amber: 0, gray: 0, green: 1, landing_within_red_window_uncovered: 1 });
    await act(async () => { renderWithProviders(<ShipmentsLeadTimeCard />); });
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    const link = screen.getByRole("link");
    expect(link.textContent).toMatch(/consignment/);
    expect(link.textContent).toMatch(/lands within 10 days with incomplete DDS/);
  });

  it("renders error message when fetch fails", async () => {
    mockSummaryError();
    await act(async () => { renderWithProviders(<ShipmentsLeadTimeCard />); });
    await waitFor(() => expect(screen.getByText(/Shipments summary unavailable/i)).toBeInTheDocument());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders skeleton while loading", async () => {
    mockSummaryNeverResolves();
    const { container } = renderWithProviders(<ShipmentsLeadTimeCard />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
