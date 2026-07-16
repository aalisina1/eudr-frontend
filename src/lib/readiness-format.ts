/**
 * Shared display helpers for the sourcing/PO readiness surfaces (#49 —
 * consolidates copies flagged by QA across PRs #46-#48: `UNIT_LABELS` was
 * duplicated 4x+ across the Sourcing list, PO Detail, dashboard worklist,
 * Supplier Detail sourcing card and the File DDS composer; `daysUntil`/
 * `formatEta` were duplicated identically in `coverage-funnel-card.tsx` and
 * `po-lots-table.tsx`). Pure display formatting, no fetch/framework deps.
 *
 * Note: this `daysUntil`/`formatEta` pair is intentionally kept separate
 * from `daysUntil`/`formatEtaLabel` in `lib/dashboard-worklist.ts` — that
 * pair normalises both sides to a UTC calendar date so a count doesn't
 * waver with time-of-day, whereas this pair is a plain timestamp diff.
 * Unifying the two would be a (subtle) behavior change; #49 is a pure
 * refactor, so each duplicate is consolidated into its own single source
 * rather than merged into one "more correct" implementation.
 */

/** Batch/lot/funnel quantity unit -> short display label. */
export const UNIT_LABELS: Record<string, string> = { KG: "kg", TONNES: "t", M3: "m³", PIECES: "pcs" };

/** Whole days between now and `dateStr` (negative = overdue); `null` when
 * there's no date to measure against. */
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

/** "20 Jul" — matches the DeadlineChip/design's short ETA label format.
 * `timeZone: "UTC"` — these are date-only (`DateField`) values; `new
 * Date("2025-10-01")` parses as UTC midnight, so formatting in the
 * viewer's local zone can roll the displayed calendar day (and even
 * month) backward west of UTC. Force UTC so the date always reads as
 * the day the backend actually stored. */
export function formatEta(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
