/**
 * Pure derivation helpers behind the File DDS composition page (#26,
 * sourcing-readiness.design-prompt.md Prompt C + Round-2 item 1). Kept
 * framework/fetch-free (mirrors `src/lib/dashboard-worklist.ts`'s pattern) so
 * the sum/range/meter/split arithmetic is unit-testable in isolation; the
 * composer component (`src/components/due-diligence/file-dds-composer.tsx`)
 * is the only caller.
 */
import type { LotReadiness, PayloadEstimateBatchRow } from "@/lib/api/types";

// ── Declaration summary: net mass + harvest-period range ──

/** kg-per-unit for the mass units convertible to a common denominator —
 * mirrors the backend's own `_KG_PER_UNIT` in `apps/supply_chain/readiness.py`
 * (M3/PIECES are not mass units and are excluded, not converted). */
const KG_PER_UNIT: Record<string, number> = { KG: 1, TONNES: 1000 };

export interface NetMassSummary {
  /** Total net mass of CHECKED lots, in kg, across mass-unit lots only. */
  totalKg: number;
  /** Count of checked lots in a non-mass unit (M3/PIECES) excluded from `totalKg`. */
  excludedUnitCount: number;
}

/** Auto-sums the net mass of the CHECKED lots (Prompt C's "Declaration
 * summary" card) — converts KG/TONNES to a common kg total; a checked lot in
 * a non-mass unit (M3/PIECES) can't be summed into a mass total at all, so it
 * is excluded and counted separately (surfaced as a caption, never silently
 * dropped) — same convention as the backend's `aggregate_overall`. */
export function summarizeNetMass(lots: LotReadiness[], checkedIds: ReadonlySet<string>): NetMassSummary {
  let totalKg = 0;
  let excludedUnitCount = 0;
  for (const lot of lots) {
    if (!checkedIds.has(lot.id)) continue;
    const factor = KG_PER_UNIT[lot.unit];
    if (factor === undefined) {
      excludedUnitCount += 1;
      continue;
    }
    totalKg += Number(lot.quantity) * factor;
  }
  return { totalKg, excludedUnitCount };
}

export interface HarvestRange {
  /** Earliest `harvest_period_start` across checked lots that have one, else `null`. */
  start: string | null;
  /** Latest `harvest_period_end` across checked lots that have one, else `null`. */
  end: string | null;
}

/** Min–max harvest-period range across the CHECKED lots — ISO date strings
 * sort lexicographically, so plain string min/max is exact (no Date parsing
 * needed, avoids timezone-rollover pitfalls). Lots missing a harvest period
 * entirely are skipped, not treated as "no range" for the whole set. */
export function harvestPeriodRange(lots: LotReadiness[], checkedIds: ReadonlySet<string>): HarvestRange {
  let start: string | null = null;
  let end: string | null = null;
  for (const lot of lots) {
    if (!checkedIds.has(lot.id)) continue;
    if (lot.harvest_period_start && (start === null || lot.harvest_period_start < start)) {
      start = lot.harvest_period_start;
    }
    if (lot.harvest_period_end && (end === null || lot.harvest_period_end > end)) {
      end = lot.harvest_period_end;
    }
  }
  return { start, end };
}

/** Primary vocabulary is tonnes (Round-2 item 2: "totals display in tonnes to
 * match Sourcing"); whole tonnes, thousands-separated. */
export function formatTonnes(totalKg: number): string {
  return `${Math.round(totalKg / 1000).toLocaleString()} t`;
}

/** "kg may remain as fine print" (Round-2 item 2) — the precise figure. */
export function formatKgFinePrint(totalKg: number): string {
  return `${Math.round(totalKg).toLocaleString()} kg`;
}

/** "Oct – Dec 2025" / "Nov 2025 – Jan 2026" — same vocabulary as the PO
 * Detail lots table's `formatHarvestPeriod` (`src/components/sourcing/
 * po-lots-table.tsx`), applied here to the checked-lot RANGE instead of a
 * single lot. Dates are formatted in UTC (date-only `DateField` values parse
 * as UTC midnight — formatting in a negative-offset local zone would roll the
 * displayed month/year backward). `null` when there's no start at all. */
export function formatHarvestRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (!end || end === start) return `${monthLabel(s)} ${s.getUTCFullYear()}`;
  const e = new Date(end);
  return s.getUTCFullYear() === e.getUTCFullYear()
    ? `${monthLabel(s)} – ${monthLabel(e)} ${e.getUTCFullYear()}`
    : `${monthLabel(s)} ${s.getUTCFullYear()} – ${monthLabel(e)} ${e.getUTCFullYear()}`;
}

// ── Geolocation payload meter ──

/** Decimal MB (the architect ruling's "conservative reading" of the
 * documented 25 MB — `TRACES_MAX_PAYLOAD_BYTES` on the backend is
 * `25_000_000`, not MiB), one decimal place, matching the design's
 * "18.4 MB" / "31.2 MB" copy exactly. */
export function formatMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

// ── Split-by-shipment / lot-chunk suggestion (Decision 5.3) ──

export interface SplitGroup {
  key: string;
  label: string;
  batchIds: string[];
  totalBytes: number;
}

export interface SplitSuggestion {
  /** "shipment" when >=2 distinct `shipment_reference` values are present
   * among the over-limit batches; "lot" (Decision 5.3's "else by lot
   * chunks" fallback) otherwise — one group per batch. */
  mode: "shipment" | "lot";
  groups: SplitGroup[];
}

/** Builds the "Split into N statements by shipment…" suggestion (or the
 * lot-chunk fallback) from the payload-estimate response's per-batch rows.
 * Groups always sum exactly to the aggregate (the backend guarantees
 * per-batch bytes are additive, no cross-batch plot dedup — architect ruling
 * on #94) — this is a plain client-side group-by over a server-supplied key,
 * not a reimplementation of the (write-side) consignment-grouping
 * constraints D–F, which govern how `shipment_reference` is assigned, not how
 * it's read back. `labelForBatch` resolves a lot-chunk group's display label
 * (the batch's `LOT-…` reference number) when falling back per-lot. */
export function buildSplitSuggestion(
  batches: PayloadEstimateBatchRow[],
  labelForBatch: (batchId: string) => string,
): SplitSuggestion {
  const order: string[] = [];
  const byKey = new Map<string, PayloadEstimateBatchRow[]>();
  for (const row of batches) {
    const key = row.shipment_reference ?? "__unassigned__";
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(row);
  }

  // >=2 distinct groups (a named shipment plus an "unassigned" cluster
  // counts as 2) is enough signal to group by shipment; only a single
  // cluster — everything unassigned, or everything on the same shipment —
  // falls back to Decision 5.3's "else by lot chunks".
  if (byKey.size >= 2) {
    return {
      mode: "shipment",
      groups: order.map((key) => {
        const rows = byKey.get(key)!;
        return {
          key,
          label: key === "__unassigned__" ? "No shipment assigned" : key,
          batchIds: rows.map((r) => r.batch_id),
          totalBytes: rows.reduce((sum, r) => sum + r.estimated_bytes, 0),
        };
      }),
    };
  }

  // Lot-chunk fallback — no shipment diversity to group by (either none of
  // the batches have a shipment_reference, or they all share the same one).
  return {
    mode: "lot",
    groups: batches.map((row) => ({
      key: row.batch_id,
      label: labelForBatch(row.batch_id),
      batchIds: [row.batch_id],
      totalBytes: row.estimated_bytes,
    })),
  };
}
