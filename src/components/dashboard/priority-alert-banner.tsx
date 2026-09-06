"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useConsignmentSummary, useRedConsignmentRows } from "@/hooks/use-dashboard-data";
import { daysUntil as daysUntilCalendar, EUDR_ENFORCEMENT_DATE, EUDR_ENFORCEMENT_DATE_LABEL } from "@/lib/dashboard-worklist";
import { daysUntil as daysUntilTimestamp } from "@/lib/readiness-format";
import type { ConsignmentRow, ConsignmentSummary } from "@/lib/api/types";

const RAG_CHIPS: { key: keyof ConsignmentSummary; label: string; dot: string }[] = [
  { key: "red", label: "Red", dot: "bg-destructive" },
  { key: "amber", label: "Amber", dot: "bg-accent" },
  { key: "gray", label: "No date", dot: "bg-muted-foreground/60" },
  { key: "green", label: "Covered", dot: "bg-primary" },
];

function RagStrip({ summary }: { summary: ConsignmentSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
      <span className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
        All shipments
      </span>
      {RAG_CHIPS.map((c) => (
        <span key={c.key} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", c.dot)} />
          <span className="font-semibold text-foreground">{summary[c.key]}</span> {c.label}
        </span>
      ))}
    </div>
  );
}

function EnforcementCountdown() {
  // Calendar-date pair (dashboard-worklist.ts), NOT the timestamp pair —
  // EUDR_ENFORCEMENT_DATE is a fixed calendar day, not a server timestamp.
  const days = daysUntilCalendar(EUDR_ENFORCEMENT_DATE);
  return (
    <div className="border-l border-border pl-4 text-right">
      <div className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
        EUDR enforcement
      </div>
      <div className="text-base font-semibold tabular-nums">{EUDR_ENFORCEMENT_DATE_LABEL}</div>
      <div className="text-sm text-muted-foreground tabular-nums">{days} days out</div>
    </div>
  );
}

/** Days until a RED consignment's landing date. `ConsignmentRow.countdown_to`
 * uses the timestamp `daysUntil` pair from `readiness-format.ts` — the SAME
 * pair `/shipments` and `/shipments/[id]` already use for this exact field —
 * not `dashboard-worklist.ts`'s calendar-day pair (that one's for
 * `BatchReadiness.next_deadline`, a different field). */
function exemplarDays(row: ConsignmentRow): number | null {
  return daysUntilTimestamp(row.countdown_to);
}

function ExemplarBanner({
  n,
  exemplar,
  ctaHref,
  ctaLabel,
  soonestOnly,
  showCta,
}: {
  n: number;
  exemplar: ConsignmentRow;
  ctaHref: string;
  ctaLabel: string;
  soonestOnly: boolean;
  showCta: boolean;
}) {
  const days = exemplarDays(exemplar);
  const uncovered = exemplar.total_count - exemplar.covered_count;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-3xl font-bold tabular-nums text-destructive">{n}</span>
      <div className="min-w-[220px] flex-1">
        <p className="text-sm font-medium text-foreground">
          {n} shipment{n === 1 ? "" : "s"} land{n === 1 ? "s" : ""} soon with no DDS filed
        </p>
        <p className="text-sm text-muted-foreground">
          {soonestOnly && "soonest: "}
          <span className="font-mono font-medium text-foreground">{exemplar.reference}</span>
          {!soonestOnly && (
            <>
              {" · "}
              {uncovered} of {exemplar.total_count} lot{exemplar.total_count === 1 ? "" : "s"} uncovered
            </>
          )}
          {days != null && <> · lands in {days}d</>}
        </p>
      </div>
      {showCta && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white no-underline"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * Tier 1 "Priority Alert" (dashboard-redesign.md) — the loudest fact on
 * `/dashboard`: is any shipment about to miss customs clearance with no DDS
 * filed, and how much runway is left before EUDR enforcement. Never states
 * the backend-owned 10-day RED window as a number, in ANY state (not just
 * the zero-state — the spec's rationale applies uniformly).
 *
 * `showCta` defaults to `true` (every non-VIEWER role, and VIEWER under the
 * spec's current decision, sees it) — Task 10 passes the real
 * `shouldShowDashboardCtas(currentUser.role)` result explicitly. Never
 * check `role` in here directly; the single flip point is
 * `VIEWER_SEES_DASHBOARD_CTAS` in `dashboard-worklist.ts` (Global
 * Constraints).
 */
export function PriorityAlertBanner({ showCta = true }: { showCta?: boolean }) {
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useConsignmentSummary();
  const { data: redRows, isLoading: rowsLoading, isError: rowsError } = useRedConsignmentRows();

  const isLoading = summaryLoading || rowsLoading;
  const n = summary?.landing_within_red_window_uncovered ?? 0;
  const exemplar = !rowsError ? redRows?.[0] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-muted-foreground" /> Priority Alert
        </CardTitle>
        <CardDescription>Is anything about to miss customs clearance with no DDS filed?</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : summaryError ? (
          <p className="text-sm text-muted-foreground">Shipments summary unavailable. Open the Shipments page.</p>
        ) : (
          <>
            {n === 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-sm text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
                Clear. No shipments landing soon without a DDS on file.
              </div>
            )}
            {n === 1 && exemplar && (
              <ExemplarBanner n={1} exemplar={exemplar} ctaHref={`/shipments/${exemplar.id}`} ctaLabel="Cover it now →" soonestOnly={false} showCta={showCta} />
            )}
            {n > 1 && exemplar && (
              <ExemplarBanner n={n} exemplar={exemplar} ctaHref="/shipments?rag=RED" ctaLabel="View all →" soonestOnly showCta={showCta} />
            )}
            {n >= 1 && !exemplar && (
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold tabular-nums text-destructive">{n}</span>
                <p className="text-sm font-medium text-foreground">
                  {n} shipment{n === 1 ? "" : "s"} land{n === 1 ? "s" : ""} soon with no DDS filed
                </p>
              </div>
            )}
            {summary && <RagStrip summary={summary} />}
            <EnforcementCountdown />
          </>
        )}
      </CardContent>
    </Card>
  );
}
