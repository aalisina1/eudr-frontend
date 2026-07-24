import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { ConsignmentForm } from "@/components/forms/consignment-form";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe("ConsignmentForm (create)", () => {
  it("POSTs a new consignment and closes on success", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ id: "c1", reference: "BL-NEW" }), { status: 201 }));
    }) as typeof fetch;
    const onOpenChange = vi.fn();
    renderWithProviders(<ConsignmentForm open onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText(/Reference/i), "BL-NEW");
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Create/i })); });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const post = calls.find((c) => c.init?.method === "POST");
    expect(post?.url).toContain("/api/v1/supply-chain/consignments/");
    expect(JSON.parse(String(post?.init?.body))).toEqual({ reference: "BL-NEW", expected_clearance_date: null, tracking_number: null });
  });

  it("blocks submit when reference is empty", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    renderWithProviders(<ConsignmentForm open onOpenChange={vi.fn()} />);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Create/i })); });
    expect(screen.getByText(/Reference is required/i)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("ConsignmentForm (edit)", () => {
  it("PATCHes an existing consignment and closes on success", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      return Promise.resolve(new Response(JSON.stringify({ id: "c7", reference: "BL-UPDATED" }), { status: 200 }));
    }) as typeof fetch;
    const onOpenChange = vi.fn();
    const existingConsignment = {
      id: "c7",
      reference: "BL-OLD",
      expected_clearance_date: "2026-08-15",
      tracking_number: "CONT-123",
      t49_request_id: null,
      latest_eta: null,
      eta_source: "NONE" as const,
      created_at: "2026-07-01",
      rag: "GREEN" as const,
      covered_count: 2,
      total_count: 3,
      countdown_to: null,
    };
    renderWithProviders(<ConsignmentForm open onOpenChange={onOpenChange} consignment={existingConsignment} />);

    const referenceInput = screen.getByLabelText(/Reference/i) as HTMLInputElement;
    expect(referenceInput.value).toBe("BL-OLD");
    await userEvent.clear(referenceInput);
    await userEvent.type(referenceInput, "BL-UPDATED");
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Save/i })); });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(patch?.url).toContain("/api/v1/supply-chain/consignments/c7/");
    expect(JSON.parse(String(patch?.init?.body))).toMatchObject({ reference: "BL-UPDATED" });
  });
});
