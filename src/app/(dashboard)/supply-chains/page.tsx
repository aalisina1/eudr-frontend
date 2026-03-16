"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, PackageOpen, Plus } from "lucide-react";
import { DataTable, type ColumnDef, type FilterDef } from "@/components/data-table";
import { BatchForm } from "@/components/forms/batch-form";
import type { Batch, BatchStatus } from "@/lib/api/types";

const STATUS_STYLE: Record<BatchStatus, { bg: string; text: string; dot: string; label: string }> = {
  DRAFT: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Draft" },
  CONFIRMED: { bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", dot: "bg-[#34D399]", label: "Confirmed" },
  IN_DDS: { bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", label: "In DDS" },
};

const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  TONNES: "t",
  M3: "m\u00B3",
  PIECES: "pcs",
};

const columns: ColumnDef<Batch>[] = [
  {
    key: "reference_number",
    header: "Reference",
    sortable: false,
    render: (b) => (
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#C7956D]/10 flex items-center justify-center shrink-0">
          <Link2 className="size-3.5 text-[#C7956D]" />
        </div>
        <span className="font-medium text-[13px] font-mono">{b.reference_number}</span>
      </div>
    ),
  },
  {
    key: "country_of_harvest",
    header: "Country",
    sortable: true,
    render: (b) => <span className="text-[13px]">{b.country_of_harvest || "\u2014"}</span>,
  },
  {
    key: "quantity",
    header: "Quantity",
    sortable: true,
    render: (b) => (
      <span className="text-[13px]">
        {b.quantity} {UNIT_LABELS[b.unit] ?? b.unit}
      </span>
    ),
  },
  {
    key: "transaction_date",
    header: "Transaction Date",
    sortable: true,
    render: (b) => (
      <span className="text-muted-foreground text-[13px]">
        {b.transaction_date ? new Date(b.transaction_date).toLocaleDateString() : "\u2014"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (b) => {
      const ss = STATUS_STYLE[b.status] ?? STATUS_STYLE.DRAFT;
      return (
        <Badge variant="secondary" className={`${ss.bg} ${ss.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
          {ss.label}
        </Badge>
      );
    },
  },
  {
    key: "created_at",
    header: "Created",
    sortable: true,
    render: (b) => (
      <span className="text-muted-foreground text-[13px]">
        {new Date(b.created_at).toLocaleDateString()}
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
      { label: "Confirmed", value: "CONFIRMED" },
      { label: "In DDS", value: "IN_DDS" },
    ],
  },
];

export default function SupplyChainsPage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Supply Chain Batches</h1>
          <p className="text-sm text-muted-foreground">Track commodity batches through the supply chain</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New Batch
        </Button>
      </div>

      <DataTable<Batch>
        queryKey="batches"
        endpoint="/api/v1/supply-chain/batches/"
        columns={columns}
        filters={filters}
        searchPlaceholder="Search by reference or country..."
        rowKey={(b) => b.id}
        onRowClick={(b) => router.push(`/supply-chains/${b.id}`)}
        emptyIcon={<PackageOpen className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No batches yet"
        emptyDescription="Batches link commodity volumes to land plots and suppliers"
      />

      <BatchForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
