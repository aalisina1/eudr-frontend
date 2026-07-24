import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { AssignToConsignmentSheet } from "@/components/shipments/assign-to-consignment-sheet";
import type { ConsignmentRow } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

const OPT: ConsignmentRow = {
  id: "c9", reference: "BL-EXIST", expected_clearance_date: null, tracking_number: null,
  t49_request_id: null, latest_eta: null, eta_source: "NONE", created_at: "2026-07-20T00:00:00Z",
  rag: "GRAY", covered_count: 0, total_count: 0, countdown_to: null,
};

describe("AssignToConsignmentSheet", () => {
  it("attaches lots to a selected existing consignment", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      if (url.includes("/consignments/") && url.includes("/lots/"))
        return Promise.resolve(new Response(JSON.stringify({ added: 1, removed: 0 }), { status: 200 }));
      if (url.includes("/consignments/"))
        return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([OPT])), { status: 200 }));
      return Promise.resolve(new Response("{}", { status: 404 }));
    }) as typeof fetch;
    const onOpenChange = vi.fn();
    renderWithProviders(<AssignToConsignmentSheet open onOpenChange={onOpenChange} lotIds={["lot-a"]} />);

    await waitFor(() => expect(screen.getByText("BL-EXIST")).toBeInTheDocument());
    await userEvent.click(screen.getByText("BL-EXIST"));
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /^Assign$/i })); });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const post = calls.find((c) => c.url.includes("/lots/") && c.init?.method === "POST");
    expect(post?.url).toContain("/api/v1/supply-chain/consignments/c9/lots/");
    expect(JSON.parse(String(post?.init?.body))).toEqual({ add: ["lot-a"] });
  });
});
