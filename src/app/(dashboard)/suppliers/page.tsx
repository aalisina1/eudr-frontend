"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus } from "lucide-react";
import { DataTable, type ColumnDef, type FilterDef } from "@/components/data-table";
import { SupplierForm } from "@/components/forms/supplier-form";
import type { Supplier, KYCStatus, RiskRating } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const KYC_COLORS: Record<KYCStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING: { bg: "bg-pending/10", text: "text-pending-foreground", dot: "bg-pending", label: "Pending" },
  VERIFIED: { bg: "bg-success/10", text: "text-success-foreground", dot: "bg-success", label: "Verified" },
  REJECTED: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "Rejected" },
  EXPIRED: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Expired" },
};

const RISK_COLORS: Record<RiskRating, { bg: string; text: string; dot: string; label: string }> = {
  NOT_ASSESSED: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Not assessed" },
  LOW: { bg: "bg-success/10", text: "text-success-foreground", dot: "bg-success", label: "Low" },
  STANDARD: { bg: "bg-warning/10", text: "text-warning-foreground", dot: "bg-warning", label: "Standard" },
  HIGH: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "High" },
};

const columns: ColumnDef<Supplier>[] = [
  {
    key: "name",
    header: "Name",
    sortable: true,
    render: (s) => <span className="font-medium text-sm">{s.name}</span>,
  },
  {
    key: "country_of_origin",
    header: "Country",
    sortable: true,
    render: (s) => <span className="text-sm">{s.country_of_origin}</span>,
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
          className={`${kyc.bg} ${kyc.text} border-0 font-medium text-xs gap-1.5 px-2.5`}
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
          className={`${risk.bg} ${risk.text} border-0 font-medium text-xs gap-1.5 px-2.5`}
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
      <span className="text-muted-foreground text-sm">
        {formatDate(s.created_at)}
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
];

// Risk rating moves out of the generic `FilterDef` array (dashboard-redesign
// filtering addendum, Task 7.1): FilterDef's `activeFilters` state lives
// inside `DataTable` with no way to pass an initial value in, so it can't be
// seeded from a URL param (verified against `data-table.tsx`). Mirrors
// `/shipments`'s own `?rag=RED` deep-link pattern exactly
// (`src/app/(dashboard)/shipments/page.tsx`'s `RAG_OPTIONS`/`rag` state) —
// a plain toolbar `<select>` backed by page-level state, fed into
// `extraParams` instead of the shared component's own filter mechanism.
const RISK_OPTIONS: { value: RiskRating | ""; label: string }[] = [
  { value: "", label: "All Risk Levels" },
  // Findable on purpose: the whole point of the state is that these suppliers
  // need someone to look at them.
  { value: "NOT_ASSESSED", label: "Not assessed" },
  { value: "LOW", label: "Low" },
  { value: "STANDARD", label: "Standard" },
  { value: "HIGH", label: "High" },
];

// Dashboard Tier 4c's "Certifications expiring < 30 days" doorway lands here
// as `/suppliers?certifications_expiring=30` (eudr-app#148). Same toolbar-
// select pattern as RISK_OPTIONS above, for the same DataTable reason. The
// wider windows are not reachable from the dashboard — they exist because
// "who do I need to chase this quarter" is a real question once you are on
// this page.
const CERTS_EXPIRING_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any Certification Status" },
  { value: "30", label: "Certs expiring ≤ 30 days" },
  { value: "60", label: "Certs expiring ≤ 60 days" },
  { value: "90", label: "Certs expiring ≤ 90 days" },
];

function SuppliersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);

  // Dashboard Tier 4a's "Suppliers flagged high-risk" doorway deep-links here
  // as `/suppliers?risk_rating=HIGH` — seed the toolbar filter from the URL
  // so the destination lands pre-filtered instead of showing every supplier.
  // An absent or unrecognized value degrades to "" (no filter, full list),
  // never a crash.
  const riskParam = searchParams.get("risk_rating") ?? "";
  const [riskRating, setRiskRating] = useState(
    RISK_OPTIONS.some((o) => o.value === riskParam) ? riskParam : ""
  );

  // Tier 4c's doorway, same seed-from-URL contract as risk_rating above. An
  // unrecognized window degrades to "" (no filter) rather than passing an
  // arbitrary value through to the API.
  const certsParam = searchParams.get("certifications_expiring") ?? "";
  const [certsExpiring, setCertsExpiring] = useState(
    CERTS_EXPIRING_OPTIONS.some((o) => o.value === certsParam) ? certsParam : ""
  );

  const extraParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (riskRating) p.risk_rating = riskRating;
    if (certsExpiring) p.certifications_expiring = certsExpiring;
    return p;
  }, [riskRating, certsExpiring]);

  const toolbarExtra = (
    <>
      <select
        aria-label="Risk rating"
        value={riskRating}
        onChange={(e) => setRiskRating(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-border/60 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        {RISK_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Certification expiry"
        value={certsExpiring}
        onChange={(e) => setCertsExpiring(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-border/60 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        {CERTS_EXPIRING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Who you buy from, and whether their plot data is good enough to file on
          </p>
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
        extraParams={extraParams}
        toolbarExtra={toolbarExtra}
        searchPlaceholder="Search suppliers..."
        exportable
        rowKey={(s) => s.id}
        onRowClick={(s) => router.push(`/suppliers/${s.id}`)}
        emptyIcon={<Users className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No suppliers yet"
        emptyDescription="Suppliers arrive from a connected ERP (see Integrations), or add the first one by hand"
      />

      <SupplierForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-72" />}>
      <SuppliersPageInner />
    </Suspense>
  );
}
