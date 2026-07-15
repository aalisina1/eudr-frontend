"use client";

import { Fragment } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDdsStatements,
  usePlotsPendingValidationCount,
  useReadinessSummary,
  useStatementsFiledThisQuarter,
} from "@/hooks/use-dashboard-data";
import { formatWholeNumber, kgToTonnesLabel } from "@/lib/dashboard-worklist";

function QuietStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xl leading-none font-semibold tabular-nums">{value}</span>
      <span className="font-mono text-[10.5px] tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

/** The de-emphasised 4-stat strip above the worklist — thin dividers, mono
 * labels, NOT hero cards (design prompt: counts are context, not the
 * headline). Every value is derived from responses the worklist already
 * fetches for the cards below (readiness summary, DDS statements, plot
 * validation counts) — no new backend endpoint. */
export function StatStrip() {
  const { data: summary, isLoading: summaryLoading } = useReadinessSummary();
  const { isLoading: ddsLoading } = useDdsStatements();
  const statementsFiledThisQuarter = useStatementsFiledThisQuarter();
  const { data: plotsPending, isLoading: plotsLoading } = usePlotsPendingValidationCount();

  const isLoading = summaryLoading || ddsLoading || plotsLoading;

  if (isLoading || !summary) {
    return (
      <div className="mb-7 flex items-center gap-7" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>
    );
  }

  // "In flight" = not yet FILED — the label reads as "still moving through
  // the pipeline", which a fully-filed PO no longer is (see
  // `ReadinessSummary`/`aggregate_overall`'s `stage_counts`).
  const poInFlight = summary.po_count - (summary.stage_counts.FILED ?? 0);

  const stats: [string, string][] = [
    [formatWholeNumber(poInFlight), "POs in flight"],
    [kgToTonnesLabel(summary.funnel.uncovered_quantity), "Tonnes uncovered"],
    [formatWholeNumber(statementsFiledThisQuarter), "Statements filed this quarter"],
    [formatWholeNumber(plotsPending ?? 0), "Plots pending validation"],
  ];

  return (
    <div className="mb-7 flex flex-wrap items-center gap-7 px-0.5 pt-0.5">
      {stats.map(([value, label], i) => (
        <Fragment key={label}>
          {i > 0 && <span className="h-[30px] w-px shrink-0 bg-border" />}
          <QuietStat value={value} label={label} />
        </Fragment>
      ))}
    </div>
  );
}
