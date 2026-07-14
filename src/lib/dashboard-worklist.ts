/**
 * Pure derivation helpers behind the Dashboard worklist (#30, Prompt D:
 * `eudr-vault/10-Specs/UI-Workflows/dashboard.design-prompt.md` successor,
 * `compliance-flow-reframe.md` Phase 3). Kept framework/fetch-free so the
 * bucketing and date math are unit-testable in isolation; the data-fetching
 * hooks in `src/hooks/use-dashboard-data.ts` and the card components under
 * `src/components/dashboard/` are the only callers.
 */
import type { BatchReadiness } from "@/lib/api/types";

// ── Greeting + date line ──

/** Time-of-day greeting — the design snapshot hardcodes "Good morning"
 * (a static design-tool preview can't show "now"), but a dashboard visited
 * at 8pm reading "Good morning" would look broken. Standard 3-way split. */
export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Wednesday 8 July 2026" — matches the design snapshot's date line
 * exactly (no comma). Built from three separate `Intl` calls rather than
 * one `dateStyle`/`weekday+day+month+year` formatter, since locale
 * formatters are prone to inserting their own punctuation (e.g. en-GB's
 * long format adds a comma after the weekday). */
export function formatDateLine(now: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(now);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(now);
  return `${weekday} ${now.getDate()} ${month} ${now.getFullYear()}`;
}

// ── Deadline chip inputs (from `BatchReadiness.next_deadline`) ──

/** "20 Jul" from an ISO date-only string (e.g. "2026-07-20"). Force
 * `timeZone: "UTC"` — a date-only string parses as UTC midnight, and
 * without pinning the formatter to UTC too, a negative-offset local
 * timezone (e.g. US) would roll it back to the previous day. */
export function formatEtaLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(dateStr)
  );
}

/** Whole calendar days from `now` to `dateStr`; negative means overdue.
 * Both sides are normalised to a UTC calendar date (not a 24h timestamp
 * diff) so "1 day away" doesn't waver with time-of-day. */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(dateStr);
  const targetUTC = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetUTC - nowUTC) / 86_400_000);
}

// ── "Statements filed this quarter" ──

/** [start, end) of the calendar quarter containing `now`, in local time. */
export function getQuarterBounds(now: Date = new Date()): { start: Date; end: Date } {
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  return {
    start: new Date(now.getFullYear(), quarterStartMonth, 1),
    end: new Date(now.getFullYear(), quarterStartMonth + 3, 1),
  };
}

export function isWithinQuarter(dateStr: string | null | undefined, now: Date = new Date()): boolean {
  if (!dateStr) return false;
  const { start, end } = getQuarterBounds(now);
  const d = new Date(dateStr);
  return d >= start && d < end;
}

// ── Number formatting ──

/** Whole-number, thousands-separated — mirrors `formatQty` in the Sourcing
 * list (`app/(dashboard)/supply-chains/page.tsx`), generalised to accept a
 * plain number too (the summary endpoint's counts aren't `DecimalField`s). */
export function formatWholeNumber(value: string | number): string {
  return Math.round(Number(value)).toLocaleString();
}

/** The readiness *summary* endpoint always normalises tonnage to KG
 * (cross-PO rollup — see `ReadinessSummaryFunnel`); the stat strip's
 * "Tonnes uncovered" chip converts that to tonnes for display. */
export function kgToTonnesLabel(kg: string | number): string {
  return `${formatWholeNumber(Number(kg) / 1000)} t`;
}

// ── Worklist bucketing ──

export interface ReadinessBuckets {
  /** Ready-to-file POs, soonest/most-overdue `next_deadline` first (no
   * deadline sorts last — nothing to act on urgently). Excludes a PO that
   * is *also* `blocked`: a plot that failed deforestation validation is a
   * remediation matter first, even if the payload would technically build
   * (ADR-0014 — a human can override and file anyway, but that's a
   * deliberate choice the officer makes on the remediation card, not a
   * default "just file it" nudge here). */
  filing: BatchReadiness[];
  /** Any PO with the BLOCKED overlay, any stage — mirrors the Sourcing
   * list's own precedent of `blocked` visually overriding the stage badge
   * (`StageBadge`/`StageCell`). */
  blocked: BatchReadiness[];
  /** OPEN/ALLOCATED/PLOTS_COMPLETE POs that aren't blocked — "waiting on
   * data", not a failed check. PLOTS_COMPLETE belongs here too: the
   * readiness endpoint still returns an itemised, actionable `blockers`
   * message for it (e.g. "1 lot missing harvest period") in the same
   * format as an OPEN/ALLOCATED row — the officer needs to see that as
   * much as an earlier-stage PO waiting on data (QA finding on PR #46:
   * a fully plot-validated, deadline-bearing PO one field away from
   * fileable was silently invisible on the worklist). */
  awaiting: BatchReadiness[];
}

/** Buckets the readiness list into the Dashboard worklist's three cards.
 * Mutually exclusive by design (a PO appears in at most one bucket) so the
 * three cards read as a priority-ordered triage, not an every-PO listing —
 * a non-blocked FILED PO is the only one that deliberately appears in none
 * of them (fully filed, nothing left to act on). */
export function bucketReadiness(rows: BatchReadiness[]): ReadinessBuckets {
  const blocked = rows.filter((r) => r.blocked);

  const filing = rows
    .filter((r) => !r.blocked && r.stage === "READY")
    .slice()
    .sort((a, b) => {
      if (a.next_deadline == null && b.next_deadline == null) return 0;
      if (a.next_deadline == null) return 1;
      if (b.next_deadline == null) return -1;
      return a.next_deadline.localeCompare(b.next_deadline);
    });

  const awaiting = rows.filter(
    (r) => !r.blocked && (r.stage === "OPEN" || r.stage === "ALLOCATED" || r.stage === "PLOTS_COMPLETE")
  );

  return { filing, blocked, awaiting };
}
