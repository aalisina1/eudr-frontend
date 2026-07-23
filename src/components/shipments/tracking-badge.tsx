"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TrackingState } from "@/lib/api/types";

const TRACKING_META: Record<TrackingState, { label: string; className: string; title: string }> = {
  untracked: { label: "Not tracked", className: "text-muted-foreground", title: "No tracking number set" },
  subscribing: { label: "Subscribing…", className: "text-muted-foreground", title: "Awaiting the first tracking update" },
  live: { label: "Live", className: "border-primary/45 bg-primary/10 text-primary", title: "Live tracking feed" },
  error: {
    label: "Tracking error",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    title: "Feed unavailable — readiness still reflects DDS coverage",
  },
  quota_reached: {
    label: "Quota reached",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    title: "Tracking subscription limit hit for this org",
  },
};

export function TrackingBadge({ state, className }: { state: TrackingState; className?: string }) {
  const meta = TRACKING_META[state];
  return (
    <Badge variant="outline" title={meta.title} className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
