"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Cable, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { StageBadge } from "@/components/sourcing/stage-badge";
import { DeadlineChip } from "@/components/sourcing/deadline-chip";
import { TonnageBar } from "@/components/sourcing/tonnage-bar";
import { UNIT_LABELS } from "@/lib/readiness-format";
import type { BatchReadiness } from "@/lib/api/types";

/** DOM anchor the "Data gaps" callout scrolls to for lot/PO-shaped gaps
 * (there's no separate "lots" page to deep-link to — the fix lives inside a
 * specific PO, and this table is the entry point). Exported so
 * `supplier-data-gaps-card.tsx` doesn't hardcode the id in two places. */
export const SOURCING_TABLE_ANCHOR_ID = "supplier-sourcing-pos";

// Mirrors eudr-app `apps/supply_chain/readiness.py`'s `_KG_PER_UNIT` — the
// backend's own cross-PO tonnage normalisation (mass units only; M3/PIECES
// are excluded from the sum but still counted toward the open-PO count,
// same convention as the summary/aggregate endpoint). Duplicated here
// rather than shared across the FE/BE boundary.
const KG_PER_UNIT: Record<string, number> = { KG: 1, TONNES: 1000 };

function formatQty(value: string): string {
  return Math.round(Number(value)).toLocaleString();
}

/** Mirrors `DeadlineChip`'s own eta/day-count math. Kept local to this file
 * (rather than exported from the shared `deadline-chip.tsx`) to avoid a
 * same-file collision with #29/#30, who are concurrently wiring up the same
 * newly-merged `next_deadline` field (eudr-app #61) in their own surfaces.
 * Candidate for extraction into a shared util once all three land. */
function deadlineFromDate(nextDeadline: string | null | undefined): { etaLabel: string; days: number } | null {
  if (!nextDeadline) return null;
  const eta = new Date(`${nextDeadline}T00:00:00`);
  if (Number.isNaN(eta.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((eta.getTime() - today.getTime()) / 86_400_000);
  const etaLabel = eta.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { etaLabel, days };
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-mono font-medium text-foreground">{value}</span> {label}
    </span>
  );
}

interface SupplierSourcingCardProps {
  /** This supplier's readiness rows — fetched by the caller (the Supplier
   * Detail page) filtered by `seller_id`, so this component stays a plain,
   * easily-testable presentational piece rather than owning its own fetch. */
  pos: BatchReadiness[];
  isLoading?: boolean;
  /** Set when the readiness fetch itself failed — rendered as an inline
   * notice rather than taking down the rest of the Supplier Detail page. */
  error?: boolean;
  className?: string;
}

const MAX_ROWS = 5;

/**
 * "Sourcing from this supplier" — full-width card directly under the
 * Supplier Detail header (sourcing-readiness.design-prompt.md Prompt E +
 * Round 3, eudr-frontend #31). Reuses #44's `StageBadge` / `TonnageBar` /
 * `DeadlineChip` primitives rather than re-inventing coverage vocabulary.
 */
export function SupplierSourcingCard({ pos, isLoading, error, className }: SupplierSourcingCardProps) {
  const router = useRouter();

  // "Open" = not yet Filed — a Filed PO is done from this supplier's
  // sourcing-coverage point of view (matches the design's "4 open POs"
  // framing, which doesn't include already-filed ones).
  const openRows = useMemo(() => pos.filter((p) => p.stage !== "FILED"), [pos]);

  // Tonnage/geolocated-% intentionally sum across *every* PO for this
  // supplier this season (including already-Filed ones), not just the
  // currently-open subset above — "ordered this season" and "% of received
  // volume geolocated" are season-wide data-quality metrics, not an
  // open-orders-only figure.
  const stats = useMemo(() => {
    let orderedKg = 0;
    let allocatedKg = 0;
    let geolocatedKg = 0;
    for (const p of pos) {
      const factor = KG_PER_UNIT[p.funnel.unit];
      if (factor == null) continue; // M3/PIECES excluded from the tonnage rollup
      orderedKg += Number(p.funnel.ordered_quantity) * factor;
      allocatedKg += Number(p.funnel.allocated_quantity) * factor;
      geolocatedKg += Number(p.funnel.geolocated_quantity) * factor;
    }
    return {
      openCount: openRows.length,
      orderedTonnes: orderedKg / 1000,
      pctGeolocated: allocatedKg > 0 ? Math.round((geolocatedKg / allocatedKg) * 100) : null,
    };
  }, [pos, openRows.length]);

  // Blocked first, then soonest deadline; POs with no deadline sort last.
  const rows = useMemo(() => {
    return [...openRows].sort((a, b) => {
      if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
      const da = a.next_deadline ? new Date(a.next_deadline).getTime() : Infinity;
      const db = b.next_deadline ? new Date(b.next_deadline).getTime() : Infinity;
      return da - db;
    });
  }, [openRows]);

  const shownRows = rows.slice(0, MAX_ROWS);

  return (
    <Card id={SOURCING_TABLE_ANCHOR_ID} className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>Sourcing from this supplier</CardTitle>
        <CardDescription>
          {isLoading ? (
            "Loading sourcing data…"
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              <Stat value={stats.openCount} label={`open PO${stats.openCount === 1 ? "" : "s"}`} />
              <span>·</span>
              <Stat
                value={`${stats.orderedTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 })} t`}
                label="ordered this season"
              />
              <span>·</span>
              <Stat
                value={stats.pctGeolocated == null ? "—" : `${stats.pctGeolocated}%`}
                label="of received volume geolocated"
              />
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-1.5">
        {isLoading ? (
          <div className="space-y-2 px-3 pb-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : error ? (
          <p className="px-3 pb-2 text-sm text-destructive">Failed to load this supplier&apos;s sourcing data.</p>
        ) : rows.length === 0 ? (
          <p className="px-3 pb-2 text-sm text-muted-foreground">No open purchase orders for this supplier yet.</p>
        ) : (
          <Table>
            {rows.length > MAX_ROWS && (
              <TableCaption>
                Showing {shownRows.length} of {rows.length} open purchase orders
              </TableCaption>
            )}
            <TableHeader>
              <TableRow>
                <TableHead>PO reference</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="min-w-[186px]">Coverage</TableHead>
                <TableHead>Next deadline</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownRows.map((po) => {
                const unitLabel = UNIT_LABELS[po.funnel.unit] ?? po.funnel.unit.toLowerCase();
                const deadline = deadlineFromDate(po.next_deadline);
                const failedBlocker = po.blockers.find((b) => b.code === "PLOTS_FAILED_VALIDATION");
                return (
                  <TableRow key={po.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-mono text-[13px] font-medium text-foreground underline-offset-2 hover:underline"
                        onClick={() => router.push(`/supply-chains/${po.id}`)}
                      >
                        {po.reference_number}
                      </button>
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px]">
                      {formatQty(po.funnel.ordered_quantity)} {unitLabel}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <TonnageBar
                          ordered={Number(po.funnel.ordered_quantity)}
                          allocated={Number(po.funnel.allocated_quantity)}
                          geolocated={Number(po.funnel.geolocated_quantity)}
                          filed={Number(po.funnel.filed_quantity)}
                          unit={` ${unitLabel}`}
                        />
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatQty(po.funnel.filed_quantity)} / {formatQty(po.funnel.ordered_quantity)} {unitLabel} filed
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DeadlineChip etaLabel={deadline?.etaLabel} days={deadline?.days} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StageBadge stage={po.stage} blocked={po.blocked} />
                        {po.blocked && failedBlocker && (
                          <span className="text-[11px] text-destructive">{failedBlocker.message}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary"
                        onClick={() => router.push(`/supply-chains/${po.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-2.5 border-t px-4 py-3">
        <RefreshCw className="size-3.5 shrink-0 text-muted-foreground" />
        {/* No supplier<->data-source linkage exists in the API yet to show a
         * real per-supplier "last received Xh ago" timestamp (the design
         * mock's copy is illustrative) — kept honest/generic rather than
         * inventing one; a real timestamp is a fast-follow once that
         * linkage exists. */}
        <span className="text-[12.5px] text-muted-foreground">
          Traceability data for this supplier arrives via your connected integrations.
        </span>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-primary"
          onClick={() => router.push("/integrations")}
        >
          <Cable className="size-3.5" /> View integration
        </Button>
      </CardFooter>
    </Card>
  );
}
