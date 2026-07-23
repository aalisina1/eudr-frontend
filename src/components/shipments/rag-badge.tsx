"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConsignmentRag } from "@/lib/api/types";

interface RagBadgeProps {
  rag: ConsignmentRag;
  /** Whole days until countdown_to; baked into RED/AMBER for RED-first triage
   * (shipments.md States table [UX decision]). Null → no day suffix. */
  countdownDays?: number | null;
  /** Formatted lands-in date for the hover title, e.g. "24 Jul". */
  countdownLabel?: string | null;
  className?: string;
}

/** Consignment DDS-coverage VERDICT badge (ADR-0022 verdict-vs-diagnosis) —
 * NOT StageBadge (that's the per-lot pipeline). Reuses the StageBadge/
 * DeadlineChip tone system: destructive=RED, accent/copper=AMBER,
 * muted-outline=GRAY, primary-solid+check=GREEN. */
export function RagBadge({ rag, countdownDays, countdownLabel, className }: RagBadgeProps) {
  const title = countdownLabel ? `Lands ${countdownLabel}` : undefined;
  const daySuffix = countdownDays == null ? "" : ` · ${countdownDays} d`;

  if (rag === "GREEN") {
    return (
      <Badge title={title} className={cn("gap-1", className)}>
        <Check className="size-3" /> Covered
      </Badge>
    );
  }
  if (rag === "RED") {
    return (
      <Badge variant="destructive" title={title} className={className}>
        RED{daySuffix}
      </Badge>
    );
  }
  if (rag === "AMBER") {
    return (
      <Badge
        variant="outline"
        title={title}
        className={cn("border-accent/55 bg-accent/15 font-semibold text-accent", className)}
      >
        AMBER{daySuffix}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" title={title} className={cn("text-muted-foreground", className)}>
      No date
    </Badge>
  );
}
