import { describe, expect, it } from "vitest";
import { ledgerToCsv } from "@/lib/consignment-ledger";
import type { ConsignmentLedger } from "@/lib/api/types";

function ledger(over: Partial<ConsignmentLedger> = {}): ConsignmentLedger {
  return {
    id: "c1",
    reference: "BL-4471",
    customs_declaration_reference: "MRN-1",
    expected_clearance_date: "2026-08-01",
    created_at: "2026-07-01T00:00:00Z",
    po_references: ["PO-9001", "PO-9002"],
    dds_rows: [
      {
        dds_id: "d1",
        reference_number: "DDS-INTERNAL-1",
        covered_lot_count: 2,
        traces_reference_number: "26FREQVKTA7K2V",
        verification_number: "VERIF-123",
        traces_status: "AVAILABLE",
        submitted_at: "2026-07-10T12:00:00Z",
      },
    ],
    uncovered_lot_count: 0,
    ...over,
  };
}

describe("ledgerToCsv", () => {
  it("emits a header plus one row per covering DDS", () => {
    const lines = ledgerToCsv(ledger()).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("TRACES reference");
    expect(lines[0]).toContain("Verification number");
    expect(lines[1]).toContain("BL-4471");
    expect(lines[1]).toContain("MRN-1");
    expect(lines[1]).toContain("26FREQVKTA7K2V");
    expect(lines[1]).toContain("VERIF-123");
  });

  it("repeats consignment fields across multiple DDS rows", () => {
    const csv = ledgerToCsv(
      ledger({
        dds_rows: [
          { dds_id: "d1", reference_number: "DDS-A", covered_lot_count: 1, traces_reference_number: "REF-A", verification_number: "V-A", traces_status: "AVAILABLE", submitted_at: null },
          { dds_id: "d2", reference_number: "DDS-B", covered_lot_count: 1, traces_reference_number: "REF-B", verification_number: "V-B", traces_status: "SUBMITTED", submitted_at: null },
        ],
      }),
    );
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("BL-4471");
    expect(lines[2]).toContain("BL-4471");
  });

  it("still emits one data row when no DDS covers the consignment", () => {
    const lines = ledgerToCsv(ledger({ dds_rows: [] })).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("BL-4471");
  });

  it("quotes values containing commas (the multi-PO case)", () => {
    // po_references join with "; " to stay single-cell, but any value that
    // does contain a comma or quote must be CSV-escaped.
    const csv = ledgerToCsv(ledger({ customs_declaration_reference: 'MRN,"X"' }));
    expect(csv).toContain('"MRN,""X"""');
  });
});
