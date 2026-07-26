import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";
import { ReferenceLedgerCard } from "@/components/shipments/reference-ledger-card";
import type { ConsignmentLedger } from "@/lib/api/types";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

function ledger(over: Partial<ConsignmentLedger> = {}): ConsignmentLedger {
  return {
    id: "c1", reference: "BL-4471", customs_declaration_reference: "MRN-1",
    expected_clearance_date: "2026-08-01", created_at: "2026-07-01T00:00:00Z",
    po_references: ["PO-9001"],
    dds_rows: [{
      dds_id: "d1", reference_number: "DDS-INTERNAL-1", covered_lot_count: 2,
      traces_reference_number: "26FREQVKTA7K2V", verification_number: "VERIF-123",
      traces_status: "AVAILABLE", submitted_at: "2026-07-10T12:00:00Z",
    }],
    uncovered_lot_count: 0, ...over,
  };
}

function mockLedger(l: ConsignmentLedger) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(l), { status: 200 }),
  ) as typeof fetch;
}

async function renderCard(canWrite = true, onEdit = vi.fn()) {
  // Each call renders a fresh instance — this helper is invoked twice in a
  // single test (see "offers Add for write roles and hides it for VIEWER")
  // to compare roles, and the global afterEach-only cleanup() wouldn't run
  // between them, leaving the first render's DOM to pollute the second.
  cleanup();
  await act(async () => {
    renderWithProviders(
      <ReferenceLedgerCard consignmentId="c1" canWrite={canWrite} onEdit={onEdit} />,
    );
  });
  return onEdit;
}

describe("ReferenceLedgerCard", () => {
  it("renders the full chain incl. both halves of the TRACES pair", async () => {
    mockLedger(ledger());
    await renderCard();
    await waitFor(() => expect(screen.getByText("BL-4471")).toBeInTheDocument());
    expect(screen.getByText("PO-9001")).toBeInTheDocument();
    expect(screen.getByText("DDS-INTERNAL-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy TRACES reference" })).toHaveTextContent("26FREQVKTA7K2V");
    expect(screen.getByRole("button", { name: "Copy Verification number" })).toHaveTextContent("VERIF-123");
    expect(screen.getByText("MRN-1")).toBeInTheDocument();
  });

  it("shows 'Not submitted to TRACES' and no chips when the pair is absent", async () => {
    mockLedger(ledger({
      dds_rows: [{
        dds_id: "d1", reference_number: "DDS-DRAFT", covered_lot_count: 1,
        traces_reference_number: "", verification_number: "", traces_status: "", submitted_at: null,
      }],
    }));
    await renderCard();
    await waitFor(() => expect(screen.getByText("DDS-DRAFT")).toBeInTheDocument());
    expect(screen.getByText(/Not submitted to TRACES/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Verification number" })).toBeNull();
  });

  it("flags uncovered lots", async () => {
    mockLedger(ledger({ uncovered_lot_count: 3 }));
    await renderCard();
    await waitFor(() =>
      expect(screen.getByText(/3 lots not covered by any DDS/i)).toBeInTheDocument());
  });

  it("shows the empty-DDS state when nothing covers the consignment", async () => {
    mockLedger(ledger({ dds_rows: [] }));
    await renderCard();
    await waitFor(() =>
      expect(screen.getByText(/No DDS covers this consignment yet/i)).toBeInTheDocument());
  });

  it("offers Add for write roles and hides it for VIEWER", async () => {
    mockLedger(ledger({ customs_declaration_reference: "" }));
    const onEdit = await renderCard(true);
    await waitFor(() => expect(screen.getByText("Not recorded")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();

    globalThis.fetch = originalFetch;
    mockLedger(ledger({ customs_declaration_reference: "" }));
    await renderCard(false);
    await waitFor(() => expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
  });

  it("exports CSV for every role", async () => {
    mockLedger(ledger());
    await renderCard(false);
    await waitFor(() => expect(screen.getByText("BL-4471")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("downloads a CSV filename carrying the B/L reference on Export CSV click", async () => {
    mockLedger(ledger());
    const createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await renderCard(false);
    await waitFor(() => expect(screen.getByText("BL-4471")).toBeInTheDocument());
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /export csv/i }));
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blob] = createObjectURL.mock.calls[0];
    expect(blob.type).toContain("text/csv");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // The anchor's `download` attribute is set before .click() — inspect the
    // element the spy was invoked on rather than a fresh createElement("a").
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("ledger-BL-4471.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });

  it("renders the reference chip and a pending note when only the reference half of the pair is present (SUBMITTED, not yet AVAILABLE)", async () => {
    mockLedger(ledger({
      dds_rows: [{
        dds_id: "d1", reference_number: "DDS-HALF", covered_lot_count: 1,
        traces_reference_number: "REF-ONLY", verification_number: "",
        traces_status: "SUBMITTED", submitted_at: "2026-07-10T12:00:00Z",
      }],
    }));
    await renderCard();
    await waitFor(() => expect(screen.getByText("DDS-HALF")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Copy TRACES reference" })).toHaveTextContent("REF-ONLY");
    expect(screen.getByText("Verification number pending")).toBeInTheDocument();
    expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
    expect(screen.queryByText(/Not submitted to TRACES/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy Verification number" })).toBeNull();
  });

  it("defensively treats a verification number without a reference as not submitted (should never happen, but never render a lone verification chip)", async () => {
    mockLedger(ledger({
      dds_rows: [{
        dds_id: "d1", reference_number: "DDS-HALF2", covered_lot_count: 1,
        traces_reference_number: "", verification_number: "VERIF-ONLY",
        traces_status: "AVAILABLE", submitted_at: null,
      }],
    }));
    await renderCard();
    await waitFor(() => expect(screen.getByText("DDS-HALF2")).toBeInTheDocument());
    expect(screen.getByText(/Not submitted to TRACES/i)).toBeInTheDocument();
    expect(screen.queryByText("VERIF-ONLY")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy Verification number" })).toBeNull();
  });

  it("renders one row per covering DDS when a consignment has multiple", async () => {
    mockLedger(ledger({
      dds_rows: [
        {
          dds_id: "d1", reference_number: "DDS-A", covered_lot_count: 1,
          traces_reference_number: "REF-A", verification_number: "V-A",
          traces_status: "AVAILABLE", submitted_at: "2026-07-05T00:00:00Z",
        },
        {
          dds_id: "d2", reference_number: "DDS-B", covered_lot_count: 2,
          traces_reference_number: "", verification_number: "",
          traces_status: "", submitted_at: null,
        },
      ],
    }));
    await renderCard();
    await waitFor(() => expect(screen.getByText("DDS-A")).toBeInTheDocument());
    expect(screen.getByText("DDS-B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy TRACES reference" })).toHaveTextContent("REF-A");
    expect(screen.getByText(/Not submitted to TRACES/i)).toBeInTheDocument();
  });

  it("shows the error state when the ledger fetch fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 500 })) as typeof fetch;
    await renderCard();
    await waitFor(() =>
      expect(screen.getByText(/Failed to load the reference ledger/i)).toBeInTheDocument());
  });
});
