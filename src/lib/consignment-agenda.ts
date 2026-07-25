import type { ConsignmentRow } from "@/lib/api/types";

export type AgendaBucketKey = "overdue" | "this_week" | "next_week" | "later" | "undated";

export interface AgendaBucket {
  key: AgendaBucketKey;
  label: string;
  rows: ConsignmentRow[];
}

const LABELS: Record<AgendaBucketKey, string> = {
  overdue: "Overdue",
  this_week: "This week",
  next_week: "Next week",
  later: "Later",
  undated: "Undated",
};

const ORDER: AgendaBucketKey[] = ["overdue", "this_week", "next_week", "later", "undated"];

/** Whole days from `now` to a date-only string, normalised to UTC calendar
 * days so the count never wavers with time-of-day (same idiom as
 * dashboard-worklist.daysUntil — deliberately UTC, since countdown_to is a
 * DateField the backend stores date-only). */
function daysUntilUTC(dateStr: string, now: Date): number {
  const t = new Date(dateStr);
  const targetUTC = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetUTC - nowUTC) / 86_400_000);
}

/** Which agenda bucket a consignment falls in (arrival-dds-calendar.md).
 * Past-and-covered (GREEN) rows are excluded upstream by the backend, so a
 * negative day count here is always a real gap → overdue. */
export function bucketForRow(row: ConsignmentRow, now: Date): AgendaBucketKey {
  if (row.countdown_to == null) return "undated";
  const d = daysUntilUTC(row.countdown_to, now);
  if (d < 0) return "overdue";
  if (d <= 7) return "this_week";
  if (d <= 14) return "next_week";
  return "later";
}

/** Partition rows into non-empty buckets, in fixed order. Input order is
 * preserved within each bucket (the endpoint already returns countdown_to
 * order). */
export function bucketConsignments(rows: ConsignmentRow[], now: Date = new Date()): AgendaBucket[] {
  const groups: Record<AgendaBucketKey, ConsignmentRow[]> = {
    overdue: [], this_week: [], next_week: [], later: [], undated: [],
  };
  for (const row of rows) groups[bucketForRow(row, now)].push(row);
  return ORDER
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, label: LABELS[key], rows: groups[key] }));
}
