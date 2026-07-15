"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReadinessBlocker, ReadinessBlockerCode } from "@/lib/api/types";

/**
 * Deep-link mapping for each blocker code — sourcing-readiness.design-prompt.md
 * Prompt B ("What's blocking readiness"): icon + text + a ghost deep-link
 * button naming what's missing. Only codes with a real in-app destination
 * today get an action; the rest render informational-only (mirrors the
 * design's own "Supplier KYC verified" ok-row, which has no action either —
 * there's nothing to click through to for a check that already passed, and
 * likewise nothing to click through to for e.g. an unresolvable-product data
 * error with no dedicated editor screen in this app yet).
 */
const BLOCKER_ACTIONS: Partial<Record<ReadinessBlockerCode, { label: string; href: string }>> = {
  MISSING_HARVEST_PERIOD: { label: "Fix", href: "#lots" },
  MISSING_GEOLOCATION: { label: "Fix", href: "#lots" },
  PLOTS_FAILED_VALIDATION: { label: "Review plots", href: "/plots" },
  PLOTS_PENDING_VALIDATION: { label: "Review plots", href: "/plots" },
  PLOT_NOT_FOUND: { label: "Check integrations", href: "/integrations" },
  BATCH_NOT_FOUND: { label: "Check integrations", href: "/integrations" },
  OPERATOR_IDENTITY_INCOMPLETE: { label: "Complete profile", href: "/settings" },
  UNIT_MISMATCH: { label: "View lots", href: "#lots" },
  OVER_ALLOCATED: { label: "View lots", href: "#lots" },
};

function GapRow({ blocker }: { blocker: ReadinessBlocker }) {
  const router = useRouter();
  const action = BLOCKER_ACTIONS[blocker.code];

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5">
      <AlertTriangle className="size-4 shrink-0 text-destructive" />
      <span className="flex-1 text-[13.5px]">{blocker.message}</span>
      {action && (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-primary hover:text-primary"
          onClick={() => {
            if (action.href.startsWith("#")) {
              document.getElementById(action.href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
              router.push(action.href);
            }
          }}
        >
          {action.label} <ArrowRight className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * PO Detail "What's blocking readiness" card — each backend `Blocker`
 * itemised server-side (`apps.supply_chain.readiness._compute`, eudr-app
 * #60) becomes one concrete gap row; an all-clear state renders when the
 * array is empty (matches the design's "All data complete — ready to file"
 * primary-tinted row).
 */
export function ReadinessChecklistCard({ blockers }: { blockers: ReadinessBlocker[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s blocking readiness</CardTitle>
        <CardDescription>Concrete gaps between this order and a filed DDS</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {blockers.length > 0 ? (
          blockers.map((b) => <GapRow key={b.code} blocker={b} />)
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/8 px-3.5 py-3">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            <span className="text-[13.5px] font-medium">All data complete — this PO is ready to file</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
