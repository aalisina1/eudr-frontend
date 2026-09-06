import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { EditLotSheet } from "@/components/sourcing/edit-lot-sheet";
import type { Batch } from "@/lib/api/types";

/**
 * eudr-frontend#132. The sheet the "Fix" buttons land on. It edits exactly
 * the fields the readiness blockers name — harvest period, quantity and
 * unit, country of harvest — and hands plots off to the AssignPlotsSheet
 * that already exists rather than duplicating it.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function batch(over: Partial<Batch> = {}): Batch {
  return {
    id: "lot-1", seller_id: "s1", buyer_id: "b1", product_id: "p1", quantity: 1000,
    unit: "KG", transaction_date: "2026-01-01", country_of_harvest: "GH",
    harvest_period_start: null, harvest_period_end: null, shipment_reference: null,
    expected_clearance_date: null, fulfils_reference: null, land_plot_ids: ["p-a", "p-b"],
    reference_number: "LOT-1", status: "CONFIRMED", external_id: "", created_at: "",
    updated_at: "", ...over,
  };
}

function mockFetch(opts: { batch?: Batch; patchStatus?: number; patchBody?: unknown } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const b = opts.batch ?? batch();
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    if (init?.method === "PATCH") {
      const status = opts.patchStatus ?? 200;
      const body = opts.patchBody ?? { ...b, ...JSON.parse(String(init.body)) };
      return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.resolve(new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } }));
  });
  return calls;
}

const patchCall = (calls: { url: string; init?: RequestInit }[]) => calls.find((c) => c.init?.method === "PATCH");

describe("EditLotSheet", () => {
  it("prefills from the fetched lot and shows its plot count", async () => {
    mockFetch({ batch: batch({ quantity: 750, unit: "TONNES", country_of_harvest: "CI", harvest_period_start: "2026-02-01", harvest_period_end: "2026-03-15" }) });
    renderWithProviders(<EditLotSheet open onOpenChange={vi.fn()} lotId="lot-1" onAssignPlots={vi.fn()} />);
    expect(await screen.findByLabelText(/harvest start/i)).toHaveValue("2026-02-01");
    expect(screen.getByLabelText(/harvest end/i)).toHaveValue("2026-03-15");
    expect(screen.getByLabelText(/^quantity/i)).toHaveValue(750);
    expect(screen.getByLabelText(/^unit/i)).toHaveValue("TONNES");
    expect(screen.getByLabelText(/country of harvest/i)).toHaveValue("CI");
    expect(screen.getByText(/2 plots/i)).toBeInTheDocument();
  });

  it("PATCHes only the editable fields and invalidates readiness", async () => {
    const calls = mockFetch();
    const onSaved = vi.fn();
    const { queryClient } = renderWithProviders(
      <EditLotSheet open onOpenChange={vi.fn()} lotId="lot-1" onAssignPlots={vi.fn()} onSaved={onSaved} />
    );
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await screen.findByLabelText(/harvest start/i);
    await userEvent.type(screen.getByLabelText(/harvest start/i), "2026-03-01");
    await userEvent.type(screen.getByLabelText(/harvest end/i), "2026-04-30");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(patchCall(calls)).toBeDefined());
    const body = JSON.parse(String(patchCall(calls)!.init!.body));
    expect(body).toEqual({
      harvest_period_start: "2026-03-01",
      harvest_period_end: "2026-04-30",
      quantity: 1000,
      unit: "KG",
      country_of_harvest: "GH",
    });
    // Never the fields a lot must not change from here.
    expect(body).not.toHaveProperty("seller_id");
    expect(body).not.toHaveProperty("product_id");
    expect(body).not.toHaveProperty("land_plot_ids");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({ queryKey: ["po-readiness"] });
  });

  it("refuses a harvest end before its start without calling the API", async () => {
    // Mirrors BatchSerializer.validate(); the serializer would 400, but the
    // officer should not need a round trip to learn that.
    const calls = mockFetch();
    renderWithProviders(<EditLotSheet open onOpenChange={vi.fn()} lotId="lot-1" onAssignPlots={vi.fn()} />);
    await screen.findByLabelText(/harvest start/i);
    await userEvent.type(screen.getByLabelText(/harvest start/i), "2026-04-30");
    await userEvent.type(screen.getByLabelText(/harvest end/i), "2026-03-01");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/end.*before.*start|after the start/i)).toBeInTheDocument();
    expect(patchCall(calls)).toBeUndefined();
  });

  it("surfaces a server-side 400 inline rather than as a silent failure", async () => {
    mockFetch({ patchStatus: 400, patchBody: { harvest_period_end: ["Harvest period end must not precede start."] } });
    renderWithProviders(<EditLotSheet open onOpenChange={vi.fn()} lotId="lot-1" onAssignPlots={vi.fn()} />);
    await screen.findByLabelText(/harvest start/i);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/must not precede start/i)).toBeInTheDocument();
  });

  it("hands plots off to the assign-plots flow instead of duplicating it", async () => {
    mockFetch();
    const onAssignPlots = vi.fn();
    renderWithProviders(<EditLotSheet open onOpenChange={vi.fn()} lotId="lot-1" onAssignPlots={onAssignPlots} />);
    await screen.findByLabelText(/harvest start/i);
    await userEvent.click(screen.getByRole("button", { name: /change plots/i }));
    expect(onAssignPlots).toHaveBeenCalledWith("lot-1");
  });
});
