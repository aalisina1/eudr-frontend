"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefLink, WorkCard, WorkRow } from "@/components/dashboard/work-card";
import { DeadlineChip } from "@/components/sourcing/deadline-chip";
import {
  useDdsStatements,
  useReadinessRows,
  useRedConsignmentRows,
  useRejectedTracesSubmissions,
  useSuppliersLookup,
} from "@/hooks/use-dashboard-data";
import { bucketReadiness, daysUntil, formatEtaLabel, formatWholeNumber } from "@/lib/dashboard-worklist";
import { daysUntil as daysUntilTimestamp, UNIT_LABELS } from "@/lib/readiness-format";

interface QueueItem {
  key: string;
  ref: string;
  href: string;
  tone: "critical" | "ready";
  meta: React.ReactNode;
  reason: string;
  actionHref: string;
  actionLabel: string;
  actionVariant: "solid" | "ghost";
}

function QueueRow({ item, showCta }: { item: QueueItem; showCta: boolean }) {
  return (
    <WorkRow tone={item.tone}>
      <RefLink href={item.href}>{item.ref}</RefLink>
      {item.meta}
      <span className="text-sm text-muted-foreground">{item.reason}</span>
      <span className="flex-1" />
      {showCta && (
        <Link
          href={item.actionHref}
          className={cn(
            buttonVariants({ size: "sm", variant: item.actionVariant === "solid" ? "default" : "ghost" }),
            "gap-1.5 no-underline",
            item.actionVariant === "ghost" && "text-primary"
          )}
        >
          {item.actionLabel}
          {item.actionVariant === "solid" ? <FileText className="size-3.5" /> : <ArrowRight className="size-3.5" />}
        </Link>
      )}
    </WorkRow>
  );
}

/**
 * Tier 2 "Action Queue" (dashboard-redesign.md) — one urgency-ordered list,
 * one CTA per row, in fixed group order: land-soon uncovered (new, shared
 * RED consignment rows with Tier 1) -> TRACES-rejected/blocked (reused
 * verbatim from the pre-redesign NeedsRemediationCard) -> ready-to-file
 * (reused verbatim from the pre-redesign NeedsFilingCard). No cross-group
 * re-sort, no cross-group dedup (a lot can legitimately appear as both a
 * RED consignment row and a separately-READY PO row — see Design decisions).
 *
 * `showCta` follows the same single-flip contract as `PriorityAlertBanner`
 * (Task 6) — defaults to `true`, Task 10 passes the real
 * `shouldShowDashboardCtas(currentUser.role)` result.
 */
export function ActionQueueCard({ showCta = true }: { showCta?: boolean }) {
  const { data: redRows, isLoading: redLoading } = useRedConsignmentRows();
  const { data: readinessRows, isLoading: readinessLoading } = useReadinessRows();
  const { data: rejected, isLoading: rejectedLoading } = useRejectedTracesSubmissions();
  const { data: statements, isLoading: statementsLoading } = useDdsStatements();
  const { data: suppliersById, isLoading: suppliersLoading } = useSuppliersLookup();

  const { blocked, filing } = bucketReadiness(readinessRows ?? []);
  const refByDdsId = new Map((statements ?? []).map((s) => [s.id, s.reference_number]));

  const landSoonItems: QueueItem[] = (redRows ?? []).map((row) => {
    const uncovered = row.total_count - row.covered_count;
    const days = daysUntilTimestamp(row.countdown_to);
    return {
      key: `con-${row.id}`,
      ref: row.reference,
      href: `/shipments/${row.id}`,
      tone: "critical",
      meta: <Badge variant="destructive">{days != null ? `lands ${days}d` : "lands soon"}</Badge>,
      reason: `${uncovered} lot${uncovered === 1 ? "" : "s"} uncovered, customs window closing`,
      actionHref: `/shipments/${row.id}`,
      actionLabel: "Cover now",
      actionVariant: "solid",
    };
  });

  const rejectedItems: QueueItem[] = rejected.map((r) => ({
    key: `dds-${r.dds_id}`,
    ref: refByDdsId.get(r.dds_id) ?? r.dds_id,
    href: `/due-diligence/${r.dds_id}`,
    tone: "critical",
    meta: <Badge variant="destructive">TRACES rejected</Badge>,
    reason: r.reason,
    actionHref: `/due-diligence/${r.dds_id}`,
    actionLabel: "Remediate",
    actionVariant: "ghost",
  }));

  const blockedItems: QueueItem[] = blocked.map((po) => ({
    key: `po-blocked-${po.id}`,
    ref: po.reference_number,
    href: `/supply-chains/${po.id}`,
    tone: "critical",
    meta: <Badge variant="destructive">Blocked</Badge>,
    reason: po.blockers.find((b) => b.code === "PLOTS_FAILED_VALIDATION")?.message ?? "Blocked",
    actionHref: `/supply-chains/${po.id}`,
    actionLabel: "Review",
    actionVariant: "ghost",
  }));

  const filingItems: QueueItem[] = filing.map((po) => {
    const unitLabel = UNIT_LABELS[po.funnel.unit] ?? po.funnel.unit.toLowerCase();
    const supplier = suppliersById?.[po.seller_id];
    return {
      key: `po-filing-${po.id}`,
      ref: po.reference_number,
      href: `/supply-chains/${po.id}`,
      tone: "ready",
      meta: po.next_deadline ? (
        <DeadlineChip etaLabel={formatEtaLabel(po.next_deadline)} days={daysUntil(po.next_deadline)} />
      ) : (
        <DeadlineChip />
      ),
      reason: `${supplier?.name ?? po.seller_id.slice(-8)} · ${formatWholeNumber(po.funnel.uncovered_quantity)} ${unitLabel} uncovered`,
      actionHref: `/supply-chains/${po.id}`,
      actionLabel: "File DDS",
      actionVariant: "solid",
    };
  });

  const items = [...landSoonItems, ...rejectedItems, ...blockedItems, ...filingItems];
  const isLoading = redLoading || readinessLoading || rejectedLoading || statementsLoading || suppliersLoading;

  return (
    <WorkCard
      title="Action Queue"
      description="Most time-critical first, one action per row"
      count={items.length}
      emptyText="Nothing needs action. You're caught up."
      isLoading={isLoading}
    >
      {items.map((item) => (
        <QueueRow key={item.key} item={item} showCta={showCta} />
      ))}
    </WorkCard>
  );
}
