"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Plus } from "lucide-react";
import { DataTable, type ColumnDef, type FilterDef } from "@/components/data-table";
import { SupplierForm } from "@/components/forms/supplier-form";
import type { Supplier, KYCStatus, RiskRating } from "@/lib/api/types";

const KYC_COLORS: Record<KYCStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING: { bg: "bg-[#C7956D]/10", text: "text-[#A07850]", dot: "bg-[#C7956D]", label: "Pending" },
  VERIFIED: { bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", dot: "bg-[#34D399]", label: "Verified" },
  REJECTED: { bg: "bg-[#C23D3D]/10", text: "text-[#C23D3D]", dot: "bg-[#C23D3D]", label: "Rejected" },
  EXPIRED: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Expired" },
};

const RISK_COLORS: Record<RiskRating, { bg: string; text: string; dot: string; label: string }> = {
  LOW: { bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", dot: "bg-[#34D399]", label: "Low" },
  STANDARD: { bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", label: "Standard" },
  HIGH: { bg: "bg-[#C23D3D]/10", text: "text-[#C23D3D]", dot: "bg-[#C23D3D]", label: "High" },
};

const columns: ColumnDef<Supplier>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (s) => <span className="font-medium text-[13px]">{s.name}</span>,
  },
  {
    key: "country_of_origin",
    header: "Country",
    sortable: true,
    render: (s) => <span className="text-[13px]">{s.country_of_origin}</span>,
  },
  {
    key: "external_id",
    header: "External ID",
    render: (s) => (
      <span className="text-muted-foreground font-mono text-xs">{s.external_id || "—"}</span>
    ),
  },
  {
    key: "kyc_status",
    header: "KYC Status",
    sortable: true,
    render: (s) => {
      const kyc = KYC_COLORS[s.kyc_status];
      return (
        <Badge
          variant="secondary"
          className={`${kyc.bg} ${kyc.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${kyc.dot}`} />
          {kyc.label}
        </Badge>
      );
    },
  },
  {
    key: "risk_rating",
    header: "Risk Rating",
    sortable: true,
    render: (s) => {
      const risk = RISK_COLORS[s.risk_rating];
      return (
        <Badge
          variant="secondary"
          className={`${risk.bg} ${risk.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
          {risk.label}
        </Badge>
      );
    },
  },
  {
    key: "created_at",
    header: "Created",
    sortable: true,
    render: (s) => (
      <span className="text-muted-foreground text-[13px]">
        {new Date(s.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

const filters: FilterDef[] = [
  {
    key: "kyc_status",
    label: "All KYC Status",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Verified", value: "VERIFIED" },
      { label: "Rejected", value: "REJECTED" },
      { label: "Expired", value: "EXPIRED" },
    ],
  },
  {
    key: "risk_rating",
    label: "All Risk Levels",
    options: [
      { label: "Low", value: "LOW" },
      { label: "Standard", value: "STANDARD" },
      { label: "High", value: "HIGH" },
    ],
  },
];

export default function SuppliersPage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage your supply chain partners</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Add Supplier
        </Button>
      </div>

      <DataTable<Supplier>
        queryKey="suppliers"
        endpoint="/api/v1/suppliers/"
        columns={columns}
        filters={filters}
        searchPlaceholder="Search suppliers..."
        rowKey={(s) => s.id}
        onRowClick={(s) => router.push(`/suppliers/${s.id}`)}
        emptyIcon={<Users className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No suppliers yet"
        emptyDescription="Add your first supplier to get started"
      />

      <SupplierForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
