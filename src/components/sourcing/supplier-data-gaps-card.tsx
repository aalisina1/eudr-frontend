"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SOURCING_TABLE_ANCHOR_ID } from "@/components/sourcing/supplier-sourcing-card";
import type { BatchReadiness, ReadinessBlockerCode } from "@/lib/api/types";

type GapActionKind = "plots" | "scroll-to-sourcing";

interface GapRow {
  code: ReadinessBlockerCode;
  count: number;
  message: string;
  actionLabel: string;
  actionKind: GapActionKind;
}

/** Copy + deep-link target per blocker code, composed from the AGGREGATE
 * count across every open PO for this supplier (the backend's own
 * `Blocker.message` — see eudr-app `readiness.py` — is per-PO; these mirror
 * its phrasing but re-pluralise for the supplier-level sum).
 *
 * Deep-links: plot-shaped gaps (missing/failed/pending geolocation, an
 * unresolved plot reference) go to the global Plots list — there's no
 * supplier-scoped filter on that page yet, so this is the best honest
 * target today (follow-up candidate, not invented). Lot/PO-shaped gaps
 * (harvest period, unresolved product, no lots linked, etc.) scroll down to
 * this page's own "Sourcing from this supplier" table, since the actual fix
 * requires opening the specific PO shown there — there's no separate
 * "lots" list to deep-link to instead. */
const BLOCKER_COPY: Record<
  ReadinessBlockerCode,
  { compose: (n: number) => string; actionLabel: string; actionKind: GapActionKind }
> = {
  PLOTS_FAILED_VALIDATION: {
    compose: (n) => `${n} plot${n === 1 ? "" : "s"} failed deforestation validation`,
    actionLabel: "Review plots",
    actionKind: "plots",
  },
  MISSING_GEOLOCATION: {
    compose: (n) => `${n} lot${n === 1 ? "" : "s"} missing plot geolocation`,
    actionLabel: "View plots",
    actionKind: "plots",
  },
  MISSING_HARVEST_PERIOD: {
    compose: (n) => `${n} lot${n === 1 ? "" : "s"} missing harvest period`,
    actionLabel: "View purchase orders",
    actionKind: "scroll-to-sourcing",
  },
  PLOT_NOT_FOUND: {
    compose: (n) => `${n} referenced plot${n === 1 ? "" : "s"} not found in your organisation`,
    actionLabel: "View plots",
    actionKind: "plots",
  },
  NO_LOTS_LINKED: {
    compose: (n) => `${n} purchase order${n === 1 ? "" : "s"} with no lots linked yet`,
    actionLabel: "View purchase orders",
    actionKind: "scroll-to-sourcing",
  },
  PRODUCT_UNRESOLVABLE: {
    compose: (n) => `${n} lot${n === 1 ? "" : "s"} reference an unresolvable product`,
    actionLabel: "View purchase orders",
    actionKind: "scroll-to-sourcing",
  },
  BATCH_NOT_FOUND: {
    compose: (n) => `${n} lot${n === 1 ? "" : "s"} not found in your organisation`,
    actionLabel: "View purchase orders",
    actionKind: "scroll-to-sourcing",
  },
  OPERATOR_IDENTITY_INCOMPLETE: {
    compose: (n) => `Operator identity incomplete on ${n} purchase order${n === 1 ? "" : "s"}`,
    actionLabel: "View purchase orders",
    actionKind: "scroll-to-sourcing",
  },
  UNIT_MISMATCH: {
    compose: (n) => `${n} lot${n === 1 ? "" : "s"} use a different unit and are excluded from coverage totals`,
    actionLabel: "View purchase orders",
    actionKind: "scroll-to-sourcing",
  },
  // Informational-only (never blocks or gates a stage, per eudr-app PR #83) —
  // still real data gaps worth surfacing, just ordered last.
  PLOTS_PENDING_VALIDATION: {
    compose: (n) => `${n} plot${n === 1 ? "" : "s"} pending deforestation validation`,
    actionLabel: "View plots",
    actionKind: "plots",
  },
  OVER_ALLOCATED: {
    compose: (n) => `${n} purchase order${n === 1 ? "" : "s"} over-allocated beyond ordered quantity`,
    actionLabel: "View purchase orders",
    actionKind: "scroll-to-sourcing",
  },
};

/** Stable render order: codes that set `blocked` win first, then other
 * concrete data-missing gaps, then the two informational-only codes last. */
const PRIORITY: ReadinessBlockerCode[] = [
  "PLOTS_FAILED_VALIDATION",
  "MISSING_GEOLOCATION",
  "MISSING_HARVEST_PERIOD",
  "PLOT_NOT_FOUND",
  "NO_LOTS_LINKED",
  "PRODUCT_UNRESOLVABLE",
  "BATCH_NOT_FOUND",
  "OPERATOR_IDENTITY_INCOMPLETE",
  "UNIT_MISMATCH",
  "PLOTS_PENDING_VALIDATION",
  "OVER_ALLOCATED",
];

/** Aggregates every open PO's itemised `blockers` (eudr-app PR #83's
 * per-PO readiness contract) into one supplier-level list, summing counts
 * for the same code across POs. A blocker with `count: null` (e.g.
 * `NO_LOTS_LINKED`, `OVER_ALLOCATED` — the backend already bakes the full
 * sentence into `message` rather than a count) is treated as one
 * occurrence per PO it appears on. */
export function aggregateSupplierBlockers(pos: BatchReadiness[]): GapRow[] {
  const counts = new Map<ReadinessBlockerCode, number>();
  for (const po of pos) {
    for (const b of po.blockers) {
      counts.set(b.code, (counts.get(b.code) ?? 0) + (b.count ?? 1));
    }
  }
  return PRIORITY.filter((code) => counts.has(code)).map((code) => {
    const n = counts.get(code)!;
    const copy = BLOCKER_COPY[code];
    return { code, count: n, message: copy.compose(n), actionLabel: copy.actionLabel, actionKind: copy.actionKind };
  });
}

interface SupplierDataGapsCardProps {
  pos: BatchReadiness[];
  className?: string;
}

/**
 * Destructive-outline "Data gaps" callout — supplier-level blockers
 * aggregated from the readiness endpoint (sourcing-readiness.design-prompt.md
 * Prompt E, eudr-frontend #31). Sits below "Sourcing from this supplier".
 */
export function SupplierDataGapsCard({ pos, className }: SupplierDataGapsCardProps) {
  const router = useRouter();
  const gaps = useMemo(() => aggregateSupplierBlockers(pos), [pos]);

  const handleAction = (kind: GapActionKind) => {
    if (kind === "plots") {
      router.push("/plots");
      return;
    }
    document
      .getElementById(SOURCING_TABLE_ANCHOR_ID)
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <Card className={cn("border-destructive/40 bg-destructive/[0.03]", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" /> Data gaps
        </CardTitle>
        <CardDescription>Blockers holding this supplier&apos;s coverage back</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {gaps.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            All data complete for this supplier&apos;s open orders
          </div>
        ) : (
          gaps.map((gap) => (
            <div
              key={gap.code}
              className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-card px-2.5 py-2"
            >
              <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
              <span className="flex-1 text-[13px]">{gap.message}</span>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-primary"
                onClick={() => handleAction(gap.actionKind)}
              >
                {gap.actionLabel}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
