/**
 * Pure derivation helpers behind the Dashboard worklist (#30, Prompt D:
 * `eudr-vault/10-Specs/UI-Workflows/dashboard.design-prompt.md` successor,
 * `compliance-flow-reframe.md` Phase 3). Kept framework/fetch-free so the
 * bucketing and date math are unit-testable in isolation; the data-fetching
 * hooks in `src/hooks/use-dashboard-data.ts` and the card components under
 * `src/components/dashboard/` are the only callers.
 */
import { KG_PER_UNIT } from "@/lib/readiness-format";
import type { BatchReadiness, DueDiligenceStatement, Supplier, User } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";

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
 * list (`app/(dashboard)/sourcing/page.tsx`), generalised to accept a
 * plain number too (the summary endpoint's counts aren't `DecimalField`s). */
export function formatWholeNumber(value: string | number): string {
  return formatNumber(Math.round(Number(value)));
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

// ── EUDR enforcement countdown (Tier 1) ──

/** EU Deforestation Regulation enforcement date — fixed by statute, no
 * backend field carries it (dashboard-redesign.md Design decisions: "a new
 * hardcoded client constant... if the regulation date or a grace period
 * ever changes, this needs a manual code change"). Paired with a fixed
 * display label rather than a formatter since it's a single date that will
 * never need reformatting. Use THIS file's `daysUntil` (UTC-calendar-day
 * pair) for the countdown, not `readiness-format.ts`'s — this is a pure
 * calendar date, not a timestamp. */
export const EUDR_ENFORCEMENT_DATE = "2026-12-30";
export const EUDR_ENFORCEMENT_DATE_LABEL = "30 Dec 2026";

// ── Tier 4d: DDS expiring soon ──

/** Count of SUBMITTED statements whose `valid_until` falls within (or
 * before) 90 days of `now` — Tier 4 metric 4d. Rides on `useDdsStatements()`,
 * already fetched elsewhere on the dashboard, so this needs zero new network
 * requests (dashboard-redesign.md 4d). A `valid_until` in the past (already
 * lapsed) still counts — it's the most urgent member of "expiring soon", not
 * a state to quietly exclude. */
export function countDdsExpiringWithin90Days(
  statements: DueDiligenceStatement[],
  now: Date = new Date()
): number {
  return statements.filter(
    (s) => s.status === "SUBMITTED" && s.valid_until != null && daysUntil(s.valid_until, now) <= 90
  ).length;
}

// ── VIEWER CTA-visibility gate ──

/** Single flip point for whether VIEWER sees the dashboard's action CTAs
 * ("Cover it now", "Cover now", "Remediate", "Review", "File DDS") as live
 * navigation links, or has them hidden. Per dashboard-redesign.md Journeys
 * (VIEWER section), VIEWER sees the identical cockpit including every CTA —
 * each one is a navigation link into a page that enforces its own
 * read-only posture, never a dashboard-native mutation — so this defaults
 * to `true`. Product is re-confirming this decision; if it flips to
 * hidden-for-VIEWER, changing this ONE constant is the entire change —
 * every CTA-rendering site calls `shouldShowDashboardCtas()`, never
 * compares `role === "VIEWER"` directly. Does not gate plain row/reference
 * navigation (Tier 1/2/3's `RefLink`s, Tier 4's row-level list links) —
 * those aren't action-button CTAs, matching the rest of the app's
 * unrestricted row-click-through convention. */
export const VIEWER_SEES_DASHBOARD_CTAS = true;

/** `viewerSeesCtas` defaults to the module constant above; accepting it as
 * an optional param (rather than reading the constant directly inside the
 * function body) keeps this independently unit-testable for both flag
 * states without needing to mock the module. */
export function shouldShowDashboardCtas(
  role: User["role"],
  viewerSeesCtas: boolean = VIEWER_SEES_DASHBOARD_CTAS
): boolean {
  return role !== "VIEWER" || viewerSeesCtas;
}

// ── Tier 4a: high-risk-country sourcing ──

export interface HighRiskConcentration {
  /** Distinct HIGH-risk-rated `seller_id`s that actually appear among the
   * readiness rows — a HIGH-risk supplier with no open/tracked POs doesn't
   * count (dashboard-redesign.md 4a). */
  supplierCount: number;
  /** KG-normalised share of total ordered volume sourced from HIGH-risk
   * suppliers, rounded to a whole percent; `null` when there's no volume to
   * divide by (avoids a 0/0 -> NaN reading as "0%"). */
  volumePct: number | null;
  /** Deduped display names of the matched suppliers' countries of origin,
   * in first-seen order. */
  countryNames: string[];
}

/** Joins the already-fetched readiness rows against the HIGH-risk supplier
 * list client-side (`useHighRiskSuppliers()` + `useReadinessRows()`) —
 * `risk_rating` isn't on `BatchReadiness`, so this is the only way to know
 * which POs belong to a high-risk supplier. Mirrors
 * `supplier-sourcing-card.tsx`'s KG-normalised tonnage rollup (mass units
 * only; M3/PIECES excluded from both the numerator and denominator). */
export function computeHighRiskConcentration(
  readinessRows: BatchReadiness[],
  highRiskSuppliers: Supplier[]
): HighRiskConcentration {
  const highRiskById = new Map(highRiskSuppliers.map((s) => [s.id, s]));
  const matchedSellerIds = new Set<string>();
  let highRiskKg = 0;
  let totalKg = 0;

  for (const row of readinessRows) {
    const factor = KG_PER_UNIT[row.funnel.unit];
    if (factor == null) continue;
    const kg = Number(row.funnel.ordered_quantity) * factor;
    totalKg += kg;
    if (highRiskById.has(row.seller_id)) {
      highRiskKg += kg;
      matchedSellerIds.add(row.seller_id);
    }
  }

  const countryCodes = Array.from(matchedSellerIds)
    .map((id) => highRiskById.get(id)?.country_of_origin)
    .filter((c): c is string => !!c);

  return {
    supplierCount: matchedSellerIds.size,
    volumePct: totalKg > 0 ? Math.round((highRiskKg / totalKg) * 100) : null,
    countryNames: dedupeCountryNames(countryCodes),
  };
}

const regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

/** ISO 3166-1 alpha-2 codes -> deduped display names, first-seen order.
 * `Intl.DisplayNames` is a real platform API (no invented country-name
 * table to maintain/drift) — falls back to the raw code if the runtime
 * can't resolve it. */
export function dedupeCountryNames(codes: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    let name: string;
    try {
      name = regionDisplayNames.of(code) ?? code;
    } catch {
      name = code;
    }
    names.push(name);
  }
  return names;
}
