"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LotReadiness, ReadinessBlocker, ReadinessBlockerCode } from "@/lib/api/types";

/**
 * Deep-link mapping for each blocker code — sourcing-readiness.design-prompt.md
 * Prompt B ("What's blocking readiness"): icon + text + a ghost deep-link
 * button naming what's missing. Only codes with a real in-app destination
 * today get an action; the rest render informational-only (mirrors the
 * design's own "Supplier KYC verified" ok-row, which has no action either —
 * there's nothing to click through to for a check that already passed, and
 * likewise nothing to click through to for e.g. an unresolvable-product data
 * error with no dedicated editor screen in this app yet).
 *
 * `kind: "assign-plots"` (issue #78) is the one non-link variant: plain
 * `href`s can't carry which LOT a "3 plots failed validation" blocker is
 * actually about, and the old `href: "/plots"` was a dead end (a plot LIST
 * with no assign path and no way back). Its target lot is resolved from the
 * PO's per-lot breakdown at render time (first lot with a matching
 * failed/pending count) and handed to the AssignPlotsSheet the parent page
 * owns — same "child triggers a callback, parent owns the Sheet" shape as
 * `PoLotsTable`'s `onAssignUnassigned`. Write-only affordance: absent from
 * the DOM (not disabled) unless `canWrite` — the other entries stay plain,
 * ungated links/scrolls exactly as before.
 */
type BlockerAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "assign-plots"; label: string };

const BLOCKER_ACTIONS: Partial<Record<ReadinessBlockerCode, BlockerAction>> = {
  MISSING_HARVEST_PERIOD: { kind: "link", label: "Fix", href: "#lots" },
  MISSING_GEOLOCATION: { kind: "link", label: "Fix", href: "#lots" },
  PLOTS_FAILED_VALIDATION: { kind: "assign-plots", label: "Review plots" },
  PLOTS_PENDING_VALIDATION: { kind: "assign-plots", label: "Review plots" },
  PLOT_NOT_FOUND: { kind: "link", label: "Check integrations", href: "/integrations" },
  BATCH_NOT_FOUND: { kind: "link", label: "Check integrations", href: "/integrations" },
  OPERATOR_IDENTITY_INCOMPLETE: { kind: "link", label: "Complete profile", href: "/settings" },
  UNIT_MISMATCH: { kind: "link", label: "View lots", href: "#lots" },
  OVER_ALLOCATED: { kind: "link", label: "View lots", href: "#lots" },
};

/** First lot whose per-lot breakdown actually has the plots issue this
 * blocker code names — `undefined` when nothing matches (renders no action
 * rather than a click that goes nowhere). */
function targetLotFor(code: ReadinessBlockerCode, lots: LotReadiness[]): LotReadiness | undefined {
  if (code === "PLOTS_FAILED_VALIDATION") return lots.find((l) => l.plots_failed_count > 0);
  if (code === "PLOTS_PENDING_VALIDATION") return lots.find((l) => l.plots_pending_count > 0);
  return undefined;
}

function GapRow({
  blocker,
  lots,
  canWrite,
  onAssignPlots,
}: {
  blocker: ReadinessBlocker;
  lots: LotReadiness[];
  canWrite: boolean;
  onAssignPlots: (lotId: string) => void;
}) {
  const router = useRouter();
  const action = BLOCKER_ACTIONS[blocker.code];

  let onClick: (() => void) | undefined;
  if (action?.kind === "link") {
    onClick = () => {
      if (action.href.startsWith("#")) {
        document.getElementById(action.href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        router.push(action.href);
      }
    };
  } else if (action?.kind === "assign-plots" && canWrite) {
    const target = targetLotFor(blocker.code, lots);
    if (target) onClick = () => onAssignPlots(target.id);
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5">
      <AlertTriangle className="size-4 shrink-0 text-destructive" />
      <span className="flex-1 text-[13.5px]">{blocker.message}</span>
      {action && onClick && (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-primary hover:text-primary"
          onClick={onClick}
        >
          {action.label} <ArrowRight className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

interface ReadinessChecklistCardProps {
  blockers: ReadinessBlocker[];
  /** PO's per-lot breakdown — resolves which lot an aggregate plots blocker
   * is actually about (see `targetLotFor` above). */
  lots: LotReadiness[];
  /** Write-only affordance gate (ADMIN/COMPLIANCE_OFFICER) for the
   * assign-plots action only — the other blocker actions stay ungated. */
  canWrite: boolean;
  onAssignPlots: (lotId: string) => void;
}

/**
 * PO Detail "What's blocking readiness" card — each backend `Blocker`
 * itemised server-side (`apps.supply_chain.readiness._compute`, eudr-app
 * #60) becomes one concrete gap row; an all-clear state renders when the
 * array is empty (matches the design's "All data complete — ready to file"
 * primary-tinted row).
 */
export function ReadinessChecklistCard({ blockers, lots, canWrite, onAssignPlots }: ReadinessChecklistCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s blocking readiness</CardTitle>
        <CardDescription>Concrete gaps between this order and a filed DDS</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {blockers.length > 0 ? (
          blockers.map((b) => (
            <GapRow key={b.code} blocker={b} lots={lots} canWrite={canWrite} onAssignPlots={onAssignPlots} />
          ))
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/8 px-3.5 py-3">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            <span className="text-[13.5px] font-medium">All data complete. This PO is ready to file.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
