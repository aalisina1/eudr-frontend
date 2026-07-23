"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { RagBadge } from "@/components/shipments/rag-badge";
import { TrackingBadge } from "@/components/shipments/tracking-badge";
import { ConsignmentForm } from "@/components/forms/consignment-form";
import { coveragePct, deriveTrackingState } from "@/lib/consignment-format";
import { daysUntil, formatEta } from "@/lib/readiness-format";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { ConsignmentRow } from "@/lib/api/types";

const RAG_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "GREEN", label: "Green" },
  { value: "RED", label: "Red" },
  { value: "AMBER", label: "Amber" },
  { value: "GRAY", label: "Gray" },
];

function ShipmentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: currentUser } = useCurrentUser();
  const canWrite = currentUser?.role === "ADMIN" || currentUser?.role === "COMPLIANCE_OFFICER";

  const [rag, setRag] = useState(searchParams.get("rag") ?? "");
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const extraParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (rag) p.rag = rag;
    if (after) p.countdown_after = after;
    if (before) p.countdown_before = before;
    return p;
  }, [rag, after, before]);

  // Interim SUPPLIER_CONTACT route block (shipments.md: org-internal surface).
  // Mirrors dds-traces-submission's role posture ahead of the A3 primitive;
  // replace with A3 when it lands — do not build a bespoke gate here.
  // MUST sit below every hook: an early return above useMemo would change the
  // hook count when the role resolves ("Rendered fewer hooks" crash), and the
  // redirect belongs in an effect — router.replace during render is a side
  // effect React flags.
  const isSupplierContact = currentUser?.role === "SUPPLIER_CONTACT";
  useEffect(() => {
    if (isSupplierContact) router.replace("/dashboard");
  }, [isSupplierContact, router]);
  if (isSupplierContact) return null;

  const filtersActive = !!(rag || after || before);

  const columns: ColumnDef<ConsignmentRow>[] = [
    {
      key: "reference", header: "Reference", sortable: true,
      render: (c) => <span className="font-mono text-[13px] font-medium">{c.reference}</span>,
    },
    {
      key: "rag", header: "Status",
      render: (c) => (
        <RagBadge
          rag={c.rag}
          countdownDays={daysUntil(c.countdown_to)}
          countdownLabel={c.countdown_to ? formatEta(c.countdown_to) : null}
        />
      ),
      exportValue: (c) => c.rag,
    },
    {
      key: "coverage", header: "Coverage",
      render: (c) => (
        <span className="text-[13px]">
          <span className="font-mono">{c.covered_count}/{c.total_count}</span>{" "}
          <span className="text-muted-foreground">· {coveragePct(c.covered_count, c.total_count)}%</span>
        </span>
      ),
      exportValue: (c) => `${c.covered_count}/${c.total_count}`,
    },
    // total_count IS the lot count — the shipped row has no lot_count field
    { key: "total_count", header: "Lots", render: (c) => <span className="font-mono text-[13px]">{c.total_count}</span> },
    {
      key: "latest_event_type", header: "Latest milestone",
      render: (c) =>
        c.latest_event_type ? (
          <span className="text-[12.5px]">
            {c.latest_event_type}
            {c.latest_event_at ? ` · ${formatEta(c.latest_event_at)}` : ""}
          </span>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">—</span>
        ),
    },
    {
      key: "po_count", header: "POs touched",
      render: (c) =>
        c.po_count != null ? (
          <span className="font-mono text-[13px]">{c.po_count}</span>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">—</span>
        ),
    },
    { key: "tracking", header: "Tracking", render: (c) => <TrackingBadge state={deriveTrackingState(c)} /> },
  ];

  const toolbarExtra = (
    <>
      {/* RAG filter lives in toolbarExtra, NOT DataTable's FilterDef: the
          dashboard deep-link ?rag=RED must seed the initial value, and
          FilterDef state is internal with no initializer (verified against
          data-table.tsx at review). Recorded as a UX-doc deviation in the
          self-review. */}
      <select
        aria-label="RAG status"
        value={rag}
        onChange={(e) => setRag(e.target.value)}
        className="h-9 cursor-pointer appearance-none rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        {RAG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Input type="date" aria-label="Lands after" value={after} onChange={(e) => setAfter(e.target.value)} className="h-9 w-[150px] rounded-xl bg-secondary/50 text-[13px]" />
      <Input type="date" aria-label="Lands before" value={before} onChange={(e) => setBefore(e.target.value)} className="h-9 w-[150px] rounded-xl bg-secondary/50 text-[13px]" />
      {canWrite && (
        <Button size="sm" onClick={() => setFormOpen(true)} className="h-9 gap-1.5 rounded-xl">
          <Plus className="size-3.5" /> New consignment
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display text-3xl font-light italic">Shipments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Which arriving consignments still lack a ready DDS — and when they land.
        </p>
      </header>
      <DataTable<ConsignmentRow>
        queryKey="shipments"
        endpoint="/api/v1/supply-chain/consignments/"
        columns={columns}
        extraParams={extraParams}
        toolbarExtra={toolbarExtra}
        searchable
        searchPlaceholder="Search reference or tracking #…"
        rowKey={(c) => c.id}
        onRowClick={(c) => router.push(`/shipments/${c.id}`)}
        exportable
        exportFilename="shipments"
        emptyIcon={<Ship className="size-5 text-muted-foreground" />}
        emptyTitle={filtersActive ? "No shipments match these filters" : "No shipments tracked yet"}
        emptyDescription={
          filtersActive
            ? "Try adjusting the status or date range."
            : "Consignments are created automatically when a lot gets a shipment reference, or set one up manually."
        }
        emptyAction={
          filtersActive ? (
            <Button variant="ghost" size="sm" onClick={() => { setRag(""); setAfter(""); setBefore(""); }}>
              Clear filters
            </Button>
          ) : canWrite ? (
            // BOTH first-run CTAs from the shipments.md States table: primary
            // create + ghost deep-link toward the PO lots tables (the manual
            // "Assign to consignment" path lives on PO detail → sourcing list).
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
                <Plus className="size-3.5" /> New consignment
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push("/supply-chains")}>
                Assign lots to a consignment
              </Button>
            </div>
          ) : undefined
        }
      />
      <ConsignmentForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-72" />}>
      <ShipmentsPageInner />
    </Suspense>
  );
}
