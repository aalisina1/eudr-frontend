"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RagBadge } from "@/components/shipments/rag-badge";
import { TrackingBadge } from "@/components/shipments/tracking-badge";
import { ConsignmentLotsTable } from "@/components/shipments/consignment-lots-table";
import { ConsignmentForm } from "@/components/forms/consignment-form";
import { AssignLotsSheet } from "@/components/shipments/assign-lots-sheet";
import { coveragePct, deriveTrackingState, humanizeEventType } from "@/lib/consignment-format";
import { daysUntil, formatEta } from "@/lib/readiness-format";
import { authFetch } from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import type { ConsignmentDetail } from "@/lib/api/types";

/** Divergence badge: manual clearance date vs feed ETA (shipments.md [UX
 * decision]). Destructive when the manual date is LATER than the feed ETA (risk
 * of missing the true deadline), muted-outline otherwise. Clearance date always
 * drives the countdown (Decision 1) — the badge names the disagreement. */
function DivergenceBadge({ manual, eta }: { manual: string | null; eta: string | null }) {
  if (!manual || !eta) return null;
  if (manual.slice(0, 10) === eta.slice(0, 10)) return null;
  const manualLater = new Date(manual).getTime() > new Date(eta).getTime();
  return (
    <Badge
      variant="outline"
      title="Manual date differs from live ETA — the clearance date drives the countdown"
      className={cn(manualLater ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border text-muted-foreground")}
    >
      Date ≠ ETA
    </Badge>
  );
}

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const canWrite = currentUser?.role === "ADMIN" || currentUser?.role === "COMPLIANCE_OFFICER";

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: c, isLoading: isLoadingConsignment, error } = useQuery<ConsignmentDetail>({
    queryKey: ["consignment", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/consignments/${encodeURIComponent(id)}/`);
      if (!res.ok) throw new Error("Failed to fetch consignment");
      return res.json();
    },
  });

  // Interim SUPPLIER_CONTACT route block (see the list page for rationale —
  // effect-based, since replace() during render is a side effect; hooks all
  // sit above this return so the hook count never changes).
  const isSupplierContact = currentUser?.role === "SUPPLIER_CONTACT";
  useEffect(() => {
    if (isSupplierContact) router.replace("/dashboard");
  }, [isSupplierContact, router]);
  if (isSupplierContact) return null;

  // Fail closed while the role loads — mirror the list page's content gate.
  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-96" />
      </div>
    );
  }

  if (isLoadingConsignment) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !c) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/shipments")} className="-ml-2 gap-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" /> All shipments
        </Button>
        <div className="flex items-center gap-2 rounded-xl border border-destructive/15 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          Consignment not found or failed to load.
        </div>
      </div>
    );
  }

  const trackingState = deriveTrackingState(c);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/shipments")} className="-ml-2 gap-1.5 text-muted-foreground">
        <ArrowLeft className="size-4" /> All shipments
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-display text-3xl font-light italic">{c.reference}</h1>
            <RagBadge rag={c.rag} countdownDays={daysUntil(c.countdown_to)} countdownLabel={c.countdown_to ? formatEta(c.countdown_to) : null} />
          </div>
          <p className="text-sm text-muted-foreground">
            Coverage <span className="font-mono text-foreground">{c.covered_count}/{c.total_count}</span> · {coveragePct(c.covered_count, c.total_count)}%
          </p>
          {/* Clearance date vs feed ETA + divergence */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Clearance date:{" "}
              <span className="text-foreground">{c.expected_clearance_date ? formatEta(c.expected_clearance_date) : "—"}</span>
            </span>
            <span className="text-muted-foreground">
              Feed ETA: <span className="text-foreground">{c.latest_eta ? formatEta(c.latest_eta) : "—"}</span>
            </span>
            <DivergenceBadge manual={c.expected_clearance_date} eta={c.latest_eta} />
          </div>
          {!c.expected_clearance_date && !c.latest_eta && (
            <p className="text-sm text-muted-foreground">No clearance date or ETA set{canWrite ? " — set one via Edit." : "."}</p>
          )}
          {/* Tracking status line */}
          <div className="flex items-center gap-2 text-sm">
            <TrackingBadge state={trackingState} />
            {trackingState === "untracked" && canWrite && (
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} className="h-7 text-xs text-muted-foreground">
                Set tracking #
              </Button>
            )}
          </div>
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
              <Plus className="size-3.5" /> Assign lots
            </Button>
            <Button
              size="sm"
              disabled={c.lots.length === 0}
              onClick={() => router.push(`/due-diligence?consignment=${encodeURIComponent(c.id)}`)}
              className="gap-1.5"
            >
              <FileText className="size-4" /> Compose DDS
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ConsignmentLotsTable lots={c.lots} />
        </div>
        {/* Milestone timeline */}
        <Card>
          <CardHeader><CardTitle>Milestone timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {c.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracking milestones yet.</p>
            ) : (
              c.events.map((e, i) => (
                <div key={e.id ?? `${e.event_type}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
                  <span className="text-[13px] font-medium" title={e.event_type}>{humanizeEventType(e.event_type)}</span>
                  <span className="text-xs text-muted-foreground">{formatEta(e.occurred_at)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {canWrite && (
        <>
          <ConsignmentForm open={editOpen} onOpenChange={setEditOpen} consignment={c} />
          <AssignLotsSheet
            open={assignOpen}
            onOpenChange={setAssignOpen}
            consignmentId={c.id}
            currentLots={c.lots}
          />
        </>
      )}
    </div>
  );
}
