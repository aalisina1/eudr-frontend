"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { RagBadge } from "@/components/shipments/rag-badge";
import { TrackingBadge } from "@/components/shipments/tracking-badge";
import { coveragePct, deriveTrackingState } from "@/lib/consignment-format";
import { daysUntil, formatEta } from "@/lib/readiness-format";
import { cn } from "@/lib/utils";
import type { ConsignmentRow } from "@/lib/api/types";

/** A gap still needs a DDS (not fully covered). GREEN rows render muted. */
function isGap(c: ConsignmentRow): boolean {
  return c.rag !== "GREEN";
}

export function AgendaRow({ c, canWrite }: { c: ConsignmentRow; canWrite: boolean }) {
  const gap = isGap(c);
  return (
    <div className={cn("flex items-center gap-3 py-2", !gap && "opacity-60")}>
      <RagBadge
        rag={c.rag}
        countdownDays={daysUntil(c.countdown_to)}
        countdownLabel={c.countdown_to ? formatEta(c.countdown_to) : null}
      />
      <Link href={`/shipments/${c.id}`} className="font-mono text-sm font-medium hover:underline">
        {c.reference}
      </Link>
      <span className="text-sm text-muted-foreground">
        {c.countdown_to ? `lands ${formatEta(c.countdown_to)}` : "no landing date"}
      </span>
      <span className="text-sm">
        <span className="font-mono">{c.covered_count}/{c.total_count}</span>{" "}
        <span className="text-muted-foreground">· {coveragePct(c.covered_count, c.total_count)}%</span>
      </span>
      <TrackingBadge state={deriveTrackingState(c)} className="ml-auto" />
      {gap && canWrite && (
        <Link
          href={`/submissions?consignment=${encodeURIComponent(c.id)}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Zap className="size-3" /> PREP NOW
        </Link>
      )}
    </div>
  );
}
