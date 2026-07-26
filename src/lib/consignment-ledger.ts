import type { ConsignmentLedger } from "@/lib/api/types";

const HEADERS = [
  "Consignment reference",
  "Customs declaration",
  "Clearance date",
  "PO references",
  "DDS reference",
  "TRACES reference",
  "Verification number",
  "TRACES status",
  "Lots covered",
];

/** CSV-escape a single cell — same idiom as data-table.tsx's export. */
function cell(value: string | number | null): string {
  const str = value == null ? "" : String(value);
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

/** Flatten one consignment's audit record: header + one row per covering DDS,
 * consignment fields repeated. A consignment with no covering DDS still emits
 * one data row (blank DDS columns) so the export is never header-only —
 * "this box has no DDS yet" is itself an auditable fact. */
export function ledgerToCsv(ledger: ConsignmentLedger): string {
  const base = [
    ledger.reference,
    ledger.customs_declaration_reference,
    ledger.expected_clearance_date ?? "",
    ledger.po_references.join("; "),
  ];

  const rows =
    ledger.dds_rows.length > 0
      ? ledger.dds_rows.map((d) => [
          ...base,
          d.reference_number,
          d.traces_reference_number,
          d.verification_number,
          d.traces_status,
          d.covered_lot_count,
        ])
      : [[...base, "", "", "", "", ""]];

  return [HEADERS, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}
