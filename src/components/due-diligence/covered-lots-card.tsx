"use client";

import Link from "next/link";
import { AlertTriangle, MapPin, Package, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UNIT_LABELS } from "@/lib/readiness-format";
import { formatNumber } from "@/lib/format";
import type {
  CoveredLot,
  CoveredPlot,
  FilingBlocker,
  ResolutionStatus,
  ValidationStatus,
} from "@/lib/api/types";

/** "Oct – Dec 2025" — the design vocabulary already used on the PO lots table.
 * Dates are formatted in UTC: a harvest period is a calendar fact about where
 * the goods were grown, not an instant in the reader's timezone. */
function formatHarvestPeriod(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  const monthLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (!end || end === start) return `${monthLabel(s)} ${s.getUTCFullYear()}`;
  const e = new Date(end);
  return s.getUTCFullYear() === e.getUTCFullYear()
    ? `${monthLabel(s)} – ${monthLabel(e)} ${e.getUTCFullYear()}`
    : `${monthLabel(s)} ${s.getUTCFullYear()} – ${monthLabel(e)} ${e.getUTCFullYear()}`;
}

/** The deforestation verdict, which is the reason the plot is on this screen.
 * PASSED is deliberately quiet — a page where every plot shouts is a page
 * where nothing does, and the two states worth interrupting a reader for are
 * "failed" and "nobody has checked yet". */
const VALIDATION_BADGE: Record<
  ValidationStatus,
  { label: string; className: string } | null
> = {
  PASSED: null,
  FAILED: { label: "Deforestation", className: "bg-destructive/10 text-destructive" },
  PENDING: { label: "Not checked", className: "bg-warning/15 text-warning-foreground" },
  REQUIRES_REVIEW: { label: "Needs review", className: "bg-warning/15 text-warning-foreground" },
};

/** ADR-0014: resolution is a human act recorded beside the verdict, never
 * instead of it. Only the states that change how the filing reads are shown. */
const RESOLUTION_BADGE: Record<ResolutionStatus, string | null> = {
  UNRESOLVED: null,
  AWAITING_RESURVEY: "Awaiting resurvey",
  OVERRIDDEN: "Risk accepted",
  // EXCLUDED plots never reach this component — they are dropped from the
  // filing, and so from `covered_lots`. Named for completeness only.
  EXCLUDED: "Excluded",
};

function PlotRow({ plot }: { plot: CoveredPlot }) {
  const validation = VALIDATION_BADGE[plot.validation_status];
  const resolution = RESOLUTION_BADGE[plot.resolution_status];
  return (
    <Link
      href={`/plots/${plot.id}`}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary/60 transition-colors"
    >
      <MapPin className="size-3 shrink-0 text-muted-foreground" />
      <span className="font-mono text-xs shrink-0">{plot.reference || "—"}</span>
      <span className="text-xs text-muted-foreground truncate">
        {[plot.region, plot.country].filter(Boolean).join(", ")}
      </span>
      {plot.area_hectares && (
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {Number(plot.area_hectares).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          })}{" "}
          ha
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5 shrink-0">
        {validation && (
          <Badge
            variant="secondary"
            className={`${validation.className} border-0 text-xs px-1.5 font-medium`}
          >
            {validation.label}
          </Badge>
        )}
        {resolution && (
          <Badge
            variant="secondary"
            className="bg-muted text-muted-foreground border-0 text-xs px-1.5 font-medium"
          >
            {resolution}
          </Badge>
        )}
      </span>
    </Link>
  );
}

function LotBlock({ lot }: { lot: CoveredLot }) {
  if (!lot.resolved) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
        <p className="text-sm font-medium text-destructive">
          This lot could not be resolved
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
          {lot.id}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The statement claims to cover it, but no batch with this id belongs to
          your organisation. It is listed rather than hidden, because a
          statement showing fewer lots than it declares would be worse.
        </p>
      </div>
    );
  }

  const period = formatHarvestPeriod(lot.harvest_period_start, lot.harvest_period_end);
  const unit = UNIT_LABELS[lot.unit] ?? lot.unit;
  const unresolvedPlots = Math.max(lot.plot_count - lot.plots.length, 0);

  return (
    <div className="rounded-xl border border-border/40 bg-secondary/25 px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 font-mono text-sm font-medium">
          <Package className="size-3.5 text-muted-foreground" />
          {lot.reference_number || "Unreferenced lot"}
        </span>
        {lot.is_purchase_order && (
          <Badge
            variant="secondary"
            className="bg-muted text-muted-foreground border-0 text-xs px-1.5"
          >
            Purchase order
          </Badge>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">
          {lot.quantity ? formatNumber(Number(lot.quantity)) : "—"} {unit}
        </span>
        <span className="text-sm text-muted-foreground">{lot.country_of_harvest}</span>
        {period ? (
          <span className="text-sm text-muted-foreground">{period}</span>
        ) : (
          <Badge variant="destructive" className="text-xs px-1.5">
            No harvest period
          </Badge>
        )}
      </div>

      {/* Which order this covers — the question a compliance officer is asked
          by everyone else in the business. `is_purchase_order` distinguishes
          "this lot IS the order" from "nothing links it to one". */}
      {lot.purchase_orders.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ShoppingCart className="size-3 text-muted-foreground" />
          {/* PO detail lives under /supply-chains (the "Sourcing" nav item) —
              a PO *is* a Batch (ADR-0013), so the id routes there, not to
              /shipments, which is consignments. */}
          {lot.purchase_orders.map((po) => (
            <Link
              key={po.id}
              href={`/supply-chains/${po.id}`}
              className="rounded-md bg-primary/8 px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary/15 transition-colors"
            >
              {po.reference_number || po.id.slice(0, 8)}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-border/40 pt-2">
        {lot.plot_count > 0 && (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {lot.plot_count} plot{lot.plot_count === 1 ? "" : "s"} declared
          </p>
        )}
        {lot.plots.map((plot) => (
          <PlotRow key={plot.id} plot={plot} />
        ))}
        {/* `plot_count` is what the statement declares; `plots` is what can
            still be described. A gap means it declares ground the app can no
            longer account for — a discrepancy, not a rounding detail.
            Deliberately NOT nested under `plots.length > 0`: the worst case is
            when *every* declared plot fails to resolve, and that is exactly
            the case a nested check skipped, leaving the card saying "no plots"
            while its own header counted several. */}
        {unresolvedPlots > 0 && (
          <p className="mt-1 text-xs text-destructive">
            {unresolvedPlots} declared plot{unresolvedPlots === 1 ? "" : "s"}{" "}
            could not be resolved.
          </p>
        )}
        {lot.plot_count === 0 && (
          <p className="text-sm text-destructive">
            No plots. A statement must declare the land its goods came from.
          </p>
        )}
      </div>
    </div>
  );
}

/** `filing_blockers` is a live dry-run over the batch data as it stands now,
 * not a record of what was true when the statement was filed. So an
 * already-filed statement whose plots were later excluded, or whose harvest
 * period was cleared, starts reporting blockers — and "must be fixed before
 * this can be filed" is then simply false, printed beside a verification
 * number the regulator issued. The problems are still worth showing; the
 * claim about them has to change. */
function Blockers({
  blockers,
  alreadyFiled,
}: {
  blockers: FilingBlocker[];
  alreadyFiled: boolean;
}) {
  return (
    <div className="mb-4 rounded-xl border border-destructive/15 bg-destructive/8 px-4 py-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <AlertTriangle className="size-3.5" />
        {alreadyFiled
          ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} would block re-filing this statement today`
          : `${blockers.length} thing${blockers.length === 1 ? "" : "s"} must be fixed before this can be filed`}
      </p>
      <ul className="mt-2 space-y-1.5">
        {blockers.map((blocker, i) => (
          <li key={`${blocker.field}-${i}`} className="text-sm text-destructive">
            <span className="font-mono text-xs font-medium">{blocker.field}</span>
            <span className="ml-1.5">{blocker.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the statement is about.
 *
 * A DDS is a declaration to a regulator about specific goods from specific
 * ground. The detail screen showed the activity, the risk conclusion and the
 * TRACES status — and none of the contents. Officers were reviewing, approving
 * and filing a regulated document without seeing what it said, and met the
 * problems at submit time, on another screen, after approval
 * (eudr-frontend#103).
 */
export function CoveredLotsCard({
  lots,
  blockers,
  alreadyFiled = false,
}: {
  lots: CoveredLot[] | undefined;
  blockers: FilingBlocker[] | undefined;
  /** True once the statement has been filed with TRACES. `filing_blockers` is
   * a live dry-run, so past that point it describes what would block a
   * re-filing, not what is stopping this one. */
  alreadyFiled?: boolean;
}) {
  const rows = lots ?? [];
  // `undefined` means the field was not sent — the list serializer omits it,
  // and a frontend deployed ahead of its backend would see it absent
  // everywhere. That is not the same claim as "this statement covers
  // nothing", which the card states in red and calls unfilable. Telling every
  // officer their every statement is empty would be a worse failure than
  // showing nothing.
  const notLoaded = lots === undefined;
  const plotTotal = rows.reduce((sum, lot) => sum + lot.plot_count, 0);
  const poTotal = new Set(
    rows.flatMap((lot) => lot.purchase_orders.map((po) => po.id)),
  ).size;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium">What this statement covers</h2>
        {!notLoaded && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {rows.length} lot{rows.length === 1 ? "" : "s"} · {plotTotal} plot
            {plotTotal === 1 ? "" : "s"}
            {poTotal > 0 && (
              <>
                {" "}
                · {poTotal} purchase order{poTotal === 1 ? "" : "s"}
              </>
            )}
          </p>
        )}
      </div>

      {blockers && blockers.length > 0 && (
        <Blockers blockers={blockers} alreadyFiled={alreadyFiled} />
      )}

      {notLoaded ? (
        <p className="text-sm text-muted-foreground">
          The statement&rsquo;s contents are not available here.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center">
          <p className="text-sm font-medium text-destructive">
            This statement covers no lots
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            A due diligence statement declares specific goods. TRACES requires at
            least one commodity, so this one cannot be filed as it stands.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((lot) => (
            <LotBlock key={lot.id} lot={lot} />
          ))}
        </div>
      )}
    </div>
  );
}
