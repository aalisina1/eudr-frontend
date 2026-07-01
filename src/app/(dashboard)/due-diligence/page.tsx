"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FileQuestion, Plus } from "lucide-react";
import { DataTable, type ColumnDef, type FilterDef } from "@/components/data-table";
import { DDSForm } from "@/components/forms/dds-form";
import type { DueDiligenceStatement } from "@/lib/api/types";
import { DDS_STATUS_STYLE } from "@/lib/dds-status";

const RISK_LABEL: Record<string, string> = {
  NEGLIGIBLE: "Negligible",
  NOT_NEGLIGIBLE: "Not Negligible",
};

const columns: ColumnDef<DueDiligenceStatement>[] = [
  {
    key: "reference_number",
    header: "Reference",
    sortable: true,
    render: (stmt) => (
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#E8C468]/10 flex items-center justify-center shrink-0">
          <FileText className="size-3.5 text-[#E8C468]" />
        </div>
        <span className="font-medium text-[13px] font-mono">{stmt.reference_number}</span>
      </div>
    ),
  },
  {
    key: "statement_type",
    header: "Type",
    render: (stmt) => (
      <span className="text-[13px] capitalize">{stmt.statement_type?.toLowerCase() || "\u2014"}</span>
    ),
  },
  {
    key: "risk_conclusion",
    header: "Risk Conclusion",
    render: (stmt) =>
      stmt.risk_conclusion ? (
        <Badge
          variant="secondary"
          className={`border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5 ${
            stmt.risk_conclusion === "NEGLIGIBLE"
              ? "bg-[#34D399]/10 text-[#1A6B5A]"
              : "bg-[#C23D3D]/10 text-[#C23D3D]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              stmt.risk_conclusion === "NEGLIGIBLE" ? "bg-[#34D399]" : "bg-[#C23D3D]"
            }`}
          />
          {RISK_LABEL[stmt.risk_conclusion] ?? stmt.risk_conclusion}
        </Badge>
      ) : (
        <span className="text-muted-foreground">{"\u2014"}</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (stmt) => {
      const ss = DDS_STATUS_STYLE[stmt.status] ?? DDS_STATUS_STYLE.DRAFT;
      return (
        <Badge variant="secondary" className={`${ss.bg} ${ss.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
          {ss.label}
        </Badge>
      );
    },
  },
  {
    key: "submitted_at",
    header: "Submitted",
    sortable: true,
    render: (stmt) => (
      <span className="text-muted-foreground text-[13px]">
        {stmt.submitted_at ? new Date(stmt.submitted_at).toLocaleDateString() : "\u2014"}
      </span>
    ),
  },
  {
    key: "created_at",
    header: "Created",
    sortable: true,
    render: (stmt) => (
      <span className="text-muted-foreground text-[13px]">
        {new Date(stmt.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

const filters: FilterDef[] = [
  {
    key: "status",
    label: "All Statuses",
    options: [
      { label: "Draft", value: "DRAFT" },
      { label: "Under Review", value: "UNDER_REVIEW" },
      { label: "Approved", value: "APPROVED" },
      { label: "Submitted", value: "SUBMITTED" },
      { label: "Rejected", value: "REJECTED" },
      { label: "Withdrawn", value: "WITHDRAWN" },
    ],
  },
  {
    key: "risk_conclusion",
    label: "All Risk Levels",
    options: [
      { label: "Negligible", value: "NEGLIGIBLE" },
      { label: "Not Negligible", value: "NOT_NEGLIGIBLE" },
    ],
  },
];

export default function DueDiligencePage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Submissions</h1>
          <p className="text-sm text-muted-foreground">EUDR compliance declarations</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New Statement
        </Button>
      </div>

      <DataTable<DueDiligenceStatement>
        queryKey="due-diligence"
        endpoint="/api/v1/due-diligence/statements/"
        columns={columns}
        filters={filters}
        searchPlaceholder="Search by reference number..."
        exportable
        rowKey={(stmt) => stmt.id}
        onRowClick={(stmt) => router.push(`/due-diligence/${stmt.id}`)}
        emptyIcon={<FileQuestion className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No statements yet"
        emptyDescription="Create a due diligence statement to declare your supply chain is deforestation-free"
      />

      <DDSForm
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
