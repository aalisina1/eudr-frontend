import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { AssignLotsSheet } from "@/components/shipments/assign-lots-sheet";
import type { Batch, ConsignmentLot } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

const CANDIDATE = { id: "lot-a", reference_number: "LOT-A", shipment_reference: null } as Batch;
const CURRENT: ConsignmentLot = {
  id: "l-cur", reference_number: "LOT-CUR", quantity: "1000.0000", unit: "KG",
  stage: "ALLOCATED", covered: false, covering_dds_id: null, covering_dds_reference: "",
};

describe("AssignLotsSheet", () => {
  it("POSTs picked add ids + unselected current lots and closes", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      if (url.includes("/lots/"))
        return Promise.resolve(new Response(JSON.stringify({ added: 1, removed: 1 }), { status: 200 }));
      if (url.includes("/supply-chain/batches/"))
        return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([CANDIDATE])), { status: 200 }));
      return Promise.resolve(new Response("{}", { status: 404 }));
    }) as typeof fetch;
    const onOpenChange = vi.fn();
    renderWithProviders(
      <AssignLotsSheet open onOpenChange={onOpenChange} consignmentId="c1" currentLots={[CURRENT]} />
    );

    await waitFor(() => expect(screen.getByText("LOT-A")).toBeInTheDocument());
    await userEvent.click(screen.getByText("LOT-A")); // pick to add
    await userEvent.click(screen.getByText("LOT-CUR")); // unselect to remove
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Apply/i })); });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const post = calls.find((c) => c.init?.method === "POST");
    expect(post?.url).toContain("/api/v1/supply-chain/consignments/c1/lots/");
    expect(JSON.parse(String(post?.init?.body))).toEqual({ add: ["lot-a"], remove: ["l-cur"] });
  });

  it("filters current lots from picker options", async () => {
    const candidateOnOtherConsignment = { id: "l-cur", reference_number: "LOT-CUR", shipment_reference: null } as Batch;
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/supply-chain/batches/"))
        return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([CANDIDATE, candidateOnOtherConsignment])), { status: 200 }));
      return Promise.resolve(new Response("{}", { status: 404 }));
    }) as typeof fetch;
    renderWithProviders(
      <AssignLotsSheet open onOpenChange={vi.fn()} consignmentId="c1" currentLots={[CURRENT]} />
    );

    await waitFor(() => expect(screen.getByText("LOT-A")).toBeInTheDocument());
    // LOT-A appears in picker rows
    expect(screen.getByText("LOT-A")).toBeInTheDocument();
    // LOT-CUR appears only as a chip, not in picker rows
    const chipOccurrence = screen.getByText("LOT-CUR");
    expect(chipOccurrence).toBeInTheDocument();
    // Verify there's only one LOT-CUR and it's in the chips section
    const allLotCur = screen.getAllByText("LOT-CUR");
    expect(allLotCur).toHaveLength(1);
    expect(chipOccurrence.closest('[role="group"]')).toBeInTheDocument();
  });

  it("shows moves-from hint for lots on other consignments", async () => {
    const candidateWithReference = { id: "lot-b", reference_number: "LOT-B", shipment_reference: "BL-OTHER" } as Batch;
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/supply-chain/batches/"))
        return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([CANDIDATE, candidateWithReference])), { status: 200 }));
      return Promise.resolve(new Response("{}", { status: 404 }));
    }) as typeof fetch;
    renderWithProviders(
      <AssignLotsSheet open onOpenChange={vi.fn()} consignmentId="c1" currentLots={[]} />
    );

    await waitFor(() => expect(screen.getByText("LOT-A")).toBeInTheDocument());
    // CANDIDATE (null reference) has no moves-from hint
    const lotAButton = screen.getByText("LOT-A").closest("button");
    expect(within(lotAButton!).queryByText(/moves from/)).not.toBeInTheDocument();
    // candidateWithReference shows the hint
    expect(screen.getByText(/moves from BL-OTHER/)).toBeInTheDocument();
  });
});
