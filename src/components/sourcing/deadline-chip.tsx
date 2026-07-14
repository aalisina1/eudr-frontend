"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeadlineChipProps {
  /** Formatted ETA label, e.g. "22 Aug". Omit (along with `days`) to render
   * the muted "—" placeholder — the shipment/`expected_clearance_date`
   * fields this chip needs ship with eudr-app #61 (BE-B, not yet built).
   * [FOLLOW-UP eudr-app#61] Do not invent a client-side substitute; wire
   * real props once that endpoint field exists. */
  etaLabel?: string | null;
  /** Days until the ETA; negative means overdue. */
  days?: number | null;
  /** Optional hover detail, e.g. the vessel/B/L line. */
  title?: string;
  className?: string;
}

/** Deadline chip: muted when > 14 days out, copper (accent) when <= 14,
 * destructive when <= 5 or overdue — sourcing-readiness.design-prompt.md
 * master reframe prompt. */
export function DeadlineChip({ etaLabel, days, title, className }: DeadlineChipProps) {
  if (etaLabel == null || days == null) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }

  const overdue = days < 0;
  const urgent = overdue || days <= 5;
  const soon = !urgent && days <= 14;
  const tone = urgent
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : soon
      ? "border-accent/55 bg-accent/15 text-accent"
      : "border-border text-muted-foreground";

  return (
    <span
      data-slot="deadline-chip"
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
        tone,
        className
      )}
    >
      <Clock className="size-3 shrink-0" />
      <span className="font-mono">
        ETA {etaLabel} · {overdue ? `${Math.abs(days)} d overdue` : `${days} d`}
      </span>
    </span>
  );
}
