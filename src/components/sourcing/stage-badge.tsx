"use client";

import { AlertTriangle, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReadinessStage } from "@/lib/api/types";

/** Human labels for the derived readiness pipeline — sourcing-readiness
 * .design-prompt.md master reframe prompt. */
export const STAGE_LABELS: Record<ReadinessStage, string> = {
  OPEN: "Open",
  ALLOCATED: "Allocated",
  PLOTS_COMPLETE: "Plots complete",
  READY: "Ready to file",
  FILED: "Filed",
};

/** Options for a single unified "Stage" filter select that includes the
 * independent Blocked overlay as a 7th item (matches the canonical design
 * and eudr-frontend #28's acceptance criteria) — selecting "Blocked" maps to
 * the backend's `blocked=true` query param, not a `stage=BLOCKED` value
 * (there is no such stage; blocked is orthogonal, see `StageBadge` below). */
export const STAGE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All stages" },
  { value: "OPEN", label: "Open" },
  { value: "ALLOCATED", label: "Allocated" },
  { value: "PLOTS_COMPLETE", label: "Plots complete" },
  { value: "READY", label: "Ready to file" },
  { value: "FILED", label: "Filed" },
  { value: "BLOCKED", label: "Blocked" },
];

interface StageBadgeProps {
  stage: ReadinessStage;
  /** The BLOCKED overlay — independent of `stage`, can coexist with any of
   * them (e.g. READY *and* blocked at once). When true it wins visually,
   * per the master reframe prompt ("a destructive-red variant 'Blocked'
   * overlays any stage when something failed") and eudr-app PR #83's
   * derivation (`blocked` is never folded into `stage`). */
  blocked?: boolean;
  className?: string;
}

export function StageBadge({ stage, blocked, className }: StageBadgeProps) {
  if (blocked) {
    return (
      <Badge variant="destructive" className={cn("gap-1", className)}>
        <AlertTriangle className="size-3" /> Blocked
      </Badge>
    );
  }

  if (stage === "FILED") {
    return (
      <Badge className={cn("gap-1", className)}>
        <Check className="size-3" /> Filed
      </Badge>
    );
  }

  if (stage === "READY") {
    return (
      <Badge
        variant="outline"
        className={cn("border-primary/45 bg-primary/10 font-semibold text-primary", className)}
      >
        Ready to file
      </Badge>
    );
  }

  if (stage === "PLOTS_COMPLETE") {
    return (
      <Badge
        variant="outline"
        className={cn("border-accent/55 bg-accent/15 text-accent", className)}
      >
        Plots complete
      </Badge>
    );
  }

  if (stage === "ALLOCATED") {
    return (
      <Badge variant="secondary" className={className}>
        Allocated
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("text-muted-foreground", className)}>
      Open
    </Badge>
  );
}
