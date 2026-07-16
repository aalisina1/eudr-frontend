"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineChip } from "@/components/sourcing/deadline-chip";
import { HATCH_BACKGROUND } from "@/components/sourcing/tonnage-bar";
import { cn } from "@/lib/utils";
import { UNIT_LABELS, daysUntil, formatEta } from "@/lib/readiness-format";
import type { CoverageFunnel } from "@/lib/api/types";

interface FunnelRowProps {
  label: string;
  value: number;
  max: number;
  unitLabel: string;
  hatched?: boolean;
  danger?: boolean;
  fillClassName?: string;
  note?: string;
}

function FunnelRow({ label, value, max, unitLabel, hatched, danger, fillClassName, note }: FunnelRowProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3.5">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <div className="h-3.5 overflow-hidden rounded-full bg-foreground/6">
        <div
          className={cn("h-full rounded-full", !hatched && fillClassName)}
          style={{ width: `${pct}%`, background: hatched ? HATCH_BACKGROUND : undefined }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-[12.5px] whitespace-nowrap",
          danger ? "font-medium text-destructive" : "text-foreground"
        )}
      >
        {Math.round(value).toLocaleString()} {unitLabel}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

interface CoverageFunnelCardProps {
  funnel: CoverageFunnel;
  /** PO-level soonest `expected_clearance_date` across linked lots (#61) —
   * `null` when nothing has a deadline yet. Rendered as the header's
   * `DeadlineChip`, matching the design's "deadline chip in the header". */
  nextDeadline: string | null;
}

/** PO Detail "Coverage" card — the tonnes funnel rendered large, per
 * sourcing-readiness.design-prompt.md Prompt B: Ordered -> Allocated ->
 * Geolocated -> Filed -> Uncovered, uncovered hatched and destructive-toned
 * when the deadline is near (<=14 days, matching DeadlineChip's own
 * urgency threshold). */
export function CoverageFunnelCard({ funnel, nextDeadline }: CoverageFunnelCardProps) {
  const unitLabel = UNIT_LABELS[funnel.unit] ?? funnel.unit.toLowerCase();
  const ordered = Number(funnel.ordered_quantity);
  const allocated = Number(funnel.allocated_quantity);
  const geolocated = Number(funnel.geolocated_quantity);
  const filed = Number(funnel.filed_quantity);
  const uncovered = Number(funnel.uncovered_quantity);

  const days = daysUntil(nextDeadline);
  const near = days != null && days <= 14;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>Tonnes moving toward a filed DDS</CardDescription>
          </div>
          {nextDeadline && <DeadlineChip etaLabel={formatEta(nextDeadline)} days={days} />}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        <FunnelRow label="Ordered" value={ordered} max={ordered} unitLabel={unitLabel} fillClassName="bg-foreground/25" />
        <FunnelRow label="Allocated" value={allocated} max={ordered} unitLabel={unitLabel} fillClassName="bg-foreground/40" />
        <FunnelRow label="Geolocated" value={geolocated} max={ordered} unitLabel={unitLabel} fillClassName="bg-accent" />
        <FunnelRow label="Filed" value={filed} max={ordered} unitLabel={unitLabel} fillClassName="bg-primary" />
        <FunnelRow
          label="Uncovered"
          value={uncovered}
          max={ordered}
          unitLabel={unitLabel}
          hatched
          danger={near}
          note={near && days != null ? (days < 0 ? `${Math.abs(days)}d overdue` : `clearance in ${days}d`) : undefined}
        />
      </CardContent>
    </Card>
  );
}
