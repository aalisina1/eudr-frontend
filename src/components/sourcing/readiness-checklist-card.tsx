"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BatchUnit, LotReadiness, ReadinessBlocker, ReadinessBlockerCode } from "@/lib/api/types";

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
  | { kind: "assign-plots"; label: string }
  | { kind: "edit-lot"; label: string };

/**
 * eudr-frontend#132: four of these used to point "Fix" at `#lots`, a read-only
 * table. A compliance officer was told what was wrong, pressed Fix, scrolled
 * to a table with no edit affordance, and stopped. Now every code that names
 * a fixable field lands on a control that can change it:
 *
 * - harvest period and unit open the edit-lot Sheet on the lot that has the
 *   defect (`targetLotFor` picks it from the per-lot breakdown);
 * - missing geolocation is an assign-plots action, which already existed;
 * - over-allocation has no single culprit lot, so it still scrolls to the
 *   table, which now carries an Edit per row;
 * - PLOT_NOT_FOUND / BATCH_NOT_FOUND (#84) land on the Syncs tab, where a
 *   record that referenced something the organisation does not hold is held
 *   for review, and the row says so. The blocker payload carries only a count,
 *   not the references, so a per-record deep link needs the backend follow-up
 *   filed from #84; until then, naming the tab and what to look for is the
 *   most the frontend can honestly do.
 */
const BLOCKER_ACTIONS: Partial<Record<ReadinessBlockerCode, BlockerAction>> = {
  MISSING_HARVEST_PERIOD: { kind: "edit-lot", label: "Fix" },
  MISSING_GEOLOCATION: { kind: "assign-plots", label: "Add plots" },
  PLOTS_FAILED_VALIDATION: { kind: "assign-plots", label: "Review plots" },
  PLOTS_PENDING_VALIDATION: { kind: "assign-plots", label: "Review plots" },
  PLOT_NOT_FOUND: { kind: "link", label: "Review sync records", href: "/integrations?tab=syncs" },
  BATCH_NOT_FOUND: { kind: "link", label: "Review sync records", href: "/integrations?tab=syncs" },
  // "Complete profile" was a mislabel: this blocker is about the ORGANISATION's
  // TRACES identity, not the signed-in person's profile (#158).
  OPERATOR_IDENTITY_INCOMPLETE: {
    kind: "link",
    label: "Set operator identity",
    href: "/administration/traces",
  },
  UNIT_MISMATCH: { kind: "edit-lot", label: "Fix unit" },
  OVER_ALLOCATED: { kind: "link", label: "View lots", href: "#lots" },
};

/** What to look for, for the two blockers whose fix lives in another screen. */
const INTEGRATION_HINT: Partial<Record<ReadinessBlockerCode, string>> = {
  PLOT_NOT_FOUND:
    "A sync referenced plot codes your organisation does not hold. Those records are held for review on the Syncs tab.",
  BATCH_NOT_FOUND:
    "A sync referenced lot codes your organisation does not hold. Those records are held for review on the Syncs tab.",
};

/** First lot whose per-lot breakdown actually has the issue this blocker
 * code names — `undefined` when nothing matches, which renders no action
 * rather than a click that goes nowhere. A stale blocker (every lot already
 * has a harvest period) is informational, not a button. */
function targetLotFor(
  code: ReadinessBlockerCode,
  lots: LotReadiness[],
  poUnit: BatchUnit | undefined
): LotReadiness | undefined {
  switch (code) {
    case "PLOTS_FAILED_VALIDATION":
      return lots.find((l) => l.plots_failed_count > 0);
    case "PLOTS_PENDING_VALIDATION":
      return lots.find((l) => l.plots_pending_count > 0);
    case "MISSING_GEOLOCATION":
      return lots.find((l) => l.plot_count === 0);
    case "MISSING_HARVEST_PERIOD":
      return lots.find((l) => !l.harvest_period_start || !l.harvest_period_end);
    case "UNIT_MISMATCH":
      return poUnit ? lots.find((l) => l.unit !== poUnit) : undefined;
    default:
      return undefined;
  }
}

function GapRow({
  blocker,
  lots,
  poUnit,
  canWrite,
  onAssignPlots,
  onEditLot,
}: {
  blocker: ReadinessBlocker;
  lots: LotReadiness[];
  poUnit: BatchUnit | undefined;
  canWrite: boolean;
  onAssignPlots: (lotId: string) => void;
  onEditLot: (lotId: string) => void;
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
  } else if ((action?.kind === "assign-plots" || action?.kind === "edit-lot") && canWrite) {
    const target = targetLotFor(blocker.code, lots, poUnit);
    if (target) {
      const open = action.kind === "assign-plots" ? onAssignPlots : onEditLot;
      onClick = () => open(target.id);
    }
  }

  const hint = INTEGRATION_HINT[blocker.code];

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5">
      <AlertTriangle className="size-4 shrink-0 text-destructive" />
      <span className="flex-1 text-sm">
        {blocker.message}
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
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
  /** PO's per-lot breakdown — resolves which lot an aggregate blocker is
   * actually about (see `targetLotFor` above). */
  lots: LotReadiness[];
  /** The order's unit, so UNIT_MISMATCH can find the lot that disagrees. */
  poUnit?: BatchUnit;
  /** Write-only affordance gate (ADMIN/COMPLIANCE_OFFICER) for the
   * assign-plots and edit-lot actions; plain links stay ungated. */
  canWrite: boolean;
  onAssignPlots: (lotId: string) => void;
  onEditLot: (lotId: string) => void;
}

/**
 * PO Detail "What's blocking readiness" card — each backend `Blocker`
 * itemised server-side (`apps.supply_chain.readiness._compute`, eudr-app
 * #60) becomes one concrete gap row; an all-clear state renders when the
 * array is empty (matches the design's "All data complete — ready to file"
 * primary-tinted row).
 */
export function ReadinessChecklistCard({
  blockers,
  lots,
  poUnit,
  canWrite,
  onAssignPlots,
  onEditLot,
}: ReadinessChecklistCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s blocking readiness</CardTitle>
        <CardDescription>Concrete gaps between this order and a filed DDS</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {blockers.length > 0 ? (
          blockers.map((b) => (
            <GapRow
              key={b.code}
              blocker={b}
              lots={lots}
              poUnit={poUnit}
              canWrite={canWrite}
              onAssignPlots={onAssignPlots}
              onEditLot={onEditLot}
            />
          ))
        ) : (
          <div className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/8 px-3.5 py-3">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            <span className="text-sm font-medium">All data complete. This PO is ready to file.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
