"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StageBadge } from "@/components/sourcing/stage-badge";
import { CoverageFunnelCard } from "@/components/sourcing/coverage-funnel-card";
import { ReadinessChecklistCard } from "@/components/sourcing/readiness-checklist-card";
import { PoLotsTable } from "@/components/sourcing/po-lots-table";
import { PoProvenanceCard } from "@/components/sourcing/po-provenance-card";
import { AssignToConsignmentSheet } from "@/components/shipments/assign-to-consignment-sheet";
import { useCurrentUser } from "@/hooks/use-current-user";
import { authFetch } from "@/lib/api/client";
import { UNIT_LABELS } from "@/lib/readiness-format";
import type { LotReadiness, POReadinessDetail, Product, Supplier } from "@/lib/api/types";

/** Whole-number, thousands-separated quantity — see the Sourcing list's
 * identically-named helper; funnel values are decimal strings. */
function formatQty(value: string): string {
  return Math.round(Number(value)).toLocaleString();
}

/**
 * PO Detail — sourcing-readiness.design-prompt.md Prompt B. Restructures the
 * former plain Batch detail page (unchanged route, `/supply-chains/[id]`;
 * only the nav/page copy says "Sourcing"/"PO Detail" per the master reframe
 * prompt) around the readiness endpoint (eudr-app #60/#61, PRs #83/#85):
 * stage + gated File DDS CTA, the large coverage funnel, the "what's
 * blocking readiness" checklist, the lots table grouped by shipment, and a
 * compact provenance card.
 */
export default function PoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const canWrite = currentUser?.role === "ADMIN" || currentUser?.role === "COMPLIANCE_OFFICER";
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLots, setAssignLots] = useState<LotReadiness[]>([]);

  const {
    data: po,
    isLoading,
    error,
  } = useQuery<POReadinessDetail>({
    queryKey: ["po-readiness", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/batches/${encodeURIComponent(id)}/readiness/`);
      if (!res.ok) throw new Error("Failed to fetch PO readiness");
      return res.json();
    },
  });

  // Supplier/product are resolved client-side for display — the readiness
  // contract only carries `seller_id`/`product_id` UUIDs (same convention
  // as the Sourcing list), fetched by id directly here since the detail page
  // only ever needs the one supplier/product this PO references.
  const { data: supplier } = useQuery<Supplier>({
    queryKey: ["supplier", po?.seller_id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/suppliers/${encodeURIComponent(po!.seller_id)}/`);
      if (!res.ok) throw new Error("Failed to fetch supplier");
      return res.json();
    },
    enabled: !!po?.seller_id,
    staleTime: 60_000,
  });

  const { data: product } = useQuery<Product>({
    queryKey: ["product", po?.product_id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/commodities/products/${encodeURIComponent(po!.product_id)}/`);
      if (!res.ok) throw new Error("Failed to fetch product");
      return res.json();
    },
    enabled: !!po?.product_id,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/supply-chains")} className="-ml-2 gap-1.5 text-muted-foreground">
          <ArrowLeft className="size-4" /> All purchase orders
        </Button>
        <div className="flex items-center gap-2 rounded-xl border border-destructive/15 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          Purchase order not found or failed to load.
        </div>
      </div>
    );
  }

  const unitLabel = UNIT_LABELS[po.funnel.unit] ?? po.funnel.unit.toLowerCase();
  const ready = po.stage === "READY";
  const missingSummary =
    po.blockers.map((b) => b.message).join(" · ") ||
    (po.stage === "FILED" ? "This purchase order is already fully filed." : "Not ready to file yet.");
  const totalPlots = po.lots.reduce((sum, lot) => sum + lot.plot_count, 0);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/supply-chains")}
          className="-ml-2 gap-1.5 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> All purchase orders
        </Button>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display text-3xl font-light italic">{po.reference_number}</h1>
              <StageBadge stage={po.stage} blocked={po.blocked} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {supplier?.name ?? "…"} · {supplier?.country_of_origin ?? "—"} ·{" "}
              {product?.commodity_name || product?.description || "—"}
            </p>
          </div>

          {ready ? (
            // [FOLLOW-UP #26] Routes to the Submissions surface with the PO
            // context in the query string; the File DDS composer itself
            // (reading `?po=` to prefill covered lots) is #26's scope, not
            // this issue's — do not build it here.
            <Button onClick={() => router.push(`/due-diligence?po=${po.id}`)} className="gap-1.5">
              <FileText className="size-4" /> File DDS
            </Button>
          ) : (
            <Tooltip>
              {/* `aria-disabled` + `focusableWhenDisabled` (not the native
               * `disabled` attribute) so the button itself stays the real
               * hover/focus target: a native-disabled control can't receive
               * focus or pointer events at all, which is why the tooltip
               * explaining the block previously never opened on keyboard
               * focus (mouse hover "worked" only because Chromium still lets
               * a wrapping ancestor's synthetic hover reach it). Base UI's
               * Button already guards onClick/Enter/Space against `disabled`
               * regardless of `focusableWhenDisabled`, so this stays
               * non-activatable. */}
              <TooltipTrigger
                render={
                  <Button disabled focusableWhenDisabled className="gap-1.5">
                    <FileText className="size-4" /> File DDS
                  </Button>
                }
              />
              <TooltipContent>{missingSummary}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CoverageFunnelCard funnel={po.funnel} nextDeadline={po.next_deadline} />
          <ReadinessChecklistCard blockers={po.blockers} />
        </div>

        <PoLotsTable
          lots={po.lots}
          allocatedLabel={`${formatQty(po.funnel.allocated_quantity)} ${unitLabel} allocated`}
          canAssignUnassigned={canWrite}
          onAssignUnassigned={(lots) => {
            setAssignLots(lots);
            setAssignOpen(true);
          }}
        />

        <PoProvenanceCard
          supplierId={po.seller_id}
          supplierName={supplier?.name}
          countryOfOrigin={supplier?.country_of_origin}
          plotCount={totalPlots}
          lotCount={po.lots.length}
        />

        {canWrite && (
          <AssignToConsignmentSheet
            open={assignOpen}
            onOpenChange={setAssignOpen}
            lotIds={assignLots.map((l) => l.id)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
