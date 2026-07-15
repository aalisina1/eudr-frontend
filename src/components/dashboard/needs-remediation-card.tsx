"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefLink, WorkCard, WorkRow } from "@/components/dashboard/work-card";
import {
  useDdsStatements,
  useReadinessRows,
  useRejectedTracesSubmissions,
} from "@/hooks/use-dashboard-data";
import { bucketReadiness } from "@/lib/dashboard-worklist";

interface RemediationItem {
  key: string;
  ref: string;
  href: string;
  badgeLabel: string;
  reason: string;
  actionLabel: string;
}

function RemediationRow({ item }: { item: RemediationItem }) {
  return (
    <WorkRow>
      <RefLink href={item.href}>{item.ref}</RefLink>
      <Badge variant="destructive">{item.badgeLabel}</Badge>
      <span className="text-[12.5px] text-muted-foreground">{item.reason}</span>
      <span className="flex-1" />
      <Link href={item.href} className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "gap-1.5 text-primary no-underline")}>
        {item.actionLabel} <ArrowRight className="size-3.5" />
      </Link>
    </WorkRow>
  );
}

/** "Needs remediation" — TRACES rejections and BLOCKED POs. Deep-links land
 * on the offending entity itself (compliance-flow-reframe.md: "Remediation
 * deep-links to the offending batch/plot, not just the DDS error text"):
 *
 * - A rejected DDS's actual TRACES fault is an unstructured SOAP fault
 *   string (`error_detail: [{"field": "getDds", ...}]` — see
 *   `traces_integration/poll.py`), not a batch/plot-indexed one, so the
 *   offending entity IS the DDS itself; "Remediate" lands on its detail
 *   page (which hosts the TRACES panel + amend/resubmit flow).
 * - A BLOCKED PO's `blockers` array names counts, not specific plot ids
 *   (the per-lot readiness breakdown doesn't expose those either), so
 *   "Review" lands on the PO itself — the most specific entity the data
 *   actually supports. */
export function NeedsRemediationCard() {
  const { data: rows, isLoading: rowsLoading } = useReadinessRows();
  const { data: rejected, isLoading: rejectedLoading } = useRejectedTracesSubmissions();
  const { data: statements, isLoading: statementsLoading } = useDdsStatements();

  const { blocked } = bucketReadiness(rows ?? []);
  const refByDdsId = new Map((statements ?? []).map((s) => [s.id, s.reference_number]));

  const rejectedItems: RemediationItem[] = rejected.map((r) => ({
    key: `dds-${r.dds_id}`,
    ref: refByDdsId.get(r.dds_id) ?? r.dds_id,
    href: `/due-diligence/${r.dds_id}`,
    badgeLabel: "Rejected",
    reason: r.reason,
    actionLabel: "Remediate",
  }));

  const blockedItems: RemediationItem[] = blocked.map((po) => ({
    key: `po-${po.id}`,
    ref: po.reference_number,
    href: `/supply-chains/${po.id}`,
    badgeLabel: "Blocked",
    reason: po.blockers.find((b) => b.code === "PLOTS_FAILED_VALIDATION")?.message ?? "Blocked",
    actionLabel: "Review",
  }));

  const items = [...rejectedItems, ...blockedItems];

  return (
    <WorkCard
      title="Needs remediation"
      description="Rejected by TRACES or blocked by validation"
      count={items.length}
      emptyText="Nothing rejected or blocked — no remediation open"
      isLoading={rowsLoading || rejectedLoading || statementsLoading}
    >
      {items.map((item) => (
        <RemediationRow key={item.key} item={item} />
      ))}
    </WorkCard>
  );
}
