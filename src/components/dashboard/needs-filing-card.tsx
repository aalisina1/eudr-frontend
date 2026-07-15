"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefLink, WorkCard, WorkRow } from "@/components/dashboard/work-card";
import { DeadlineChip } from "@/components/sourcing/deadline-chip";
import { useReadinessRows, useSuppliersLookup } from "@/hooks/use-dashboard-data";
import { bucketReadiness, daysUntil, formatEtaLabel, formatWholeNumber } from "@/lib/dashboard-worklist";
import type { BatchReadiness, Supplier } from "@/lib/api/types";

const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  TONNES: "t",
  M3: "m³",
  PIECES: "pcs",
};

function FilingRow({ po, supplier }: { po: BatchReadiness; supplier?: Supplier }) {
  const unitLabel = UNIT_LABELS[po.funnel.unit] ?? po.funnel.unit.toLowerCase();
  return (
    <WorkRow>
      <RefLink href={`/supply-chains/${po.id}`}>{po.reference_number}</RefLink>
      <span className="text-[13px] text-muted-foreground">{supplier?.name ?? po.seller_id.slice(-8)}</span>
      {po.next_deadline ? (
        <DeadlineChip etaLabel={formatEtaLabel(po.next_deadline)} days={daysUntil(po.next_deadline)} />
      ) : (
        <DeadlineChip />
      )}
      <span className="text-[12.5px] text-muted-foreground">
        {formatWholeNumber(po.funnel.uncovered_quantity)} {unitLabel} uncovered
      </span>
      <span className="flex-1" />
      <Link
        href={`/supply-chains/${po.id}`}
        className={cn(buttonVariants({ size: "sm" }), "gap-1.5 no-underline")}
      >
        <FileText className="size-3.5" /> File DDS
      </Link>
    </WorkRow>
  );
}

/** "Needs filing" — the worklist's highest-priority card: READY-to-file
 * POs, soonest/most-overdue deadline first (`bucketReadiness`).
 *
 * [FOLLOW-UP eudr-frontend#26] "File DDS" routes to the PO's own detail
 * page, not a dedicated File DDS composer with `?po=` prefill — that
 * composer (#26) hasn't been built yet (still open, gated behind v0.2.1 as
 * of this ticket). Once it ships, point this at it directly; until then,
 * the PO detail page is the correct interim landing spot — it's the same
 * page #29's own gated "File DDS" CTA lives on. */
export function NeedsFilingCard() {
  const { data: rows, isLoading: rowsLoading } = useReadinessRows();
  const { data: suppliersById, isLoading: suppliersLoading } = useSuppliersLookup();

  const { filing } = bucketReadiness(rows ?? []);

  return (
    <WorkCard
      title="Needs filing"
      description="Ready-to-file purchase orders and approaching clearance deadlines"
      count={filing.length}
      emptyText="Nothing needs filing — all covered"
      isLoading={rowsLoading || suppliersLoading}
    >
      {filing.map((po) => (
        <FilingRow key={po.id} po={po} supplier={suppliersById?.[po.seller_id]} />
      ))}
    </WorkCard>
  );
}
