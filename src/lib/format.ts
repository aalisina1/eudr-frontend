/**
 * Locale-pinned formatting for anything a user reads.
 *
 * Before this, 19 call sites used `toLocaleDateString()` with no locale, which
 * formats in the *viewer's* browser locale. A German auditor saw `5.9.2026` in
 * one table and `5 September 2026` in the next, inside one page, and a US
 * viewer saw `7/16/2026` where a Dutch one saw `16-7-2026`. That is a
 * correctness problem in a compliance tool, not only a voice one: the whole
 * point of a date on a DDS screen is that two people reading it agree.
 *
 * Everything here pins **en-GB** (spec Decision 2) and uses a spelled-out
 * month, so the value is unambiguous to every reader regardless of whether
 * they read day-first or month-first.
 *
 * The `require-date-locale` ESLint rule (ADR-0027) rejects bare
 * `toLocale*String()` calls, so new code lands here by default.
 */

const LOCALE = "en-GB";

/** A backend `DateField` serialises as "2026-07-20" with no time or zone. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `new Date("2026-07-20")` parses as UTC midnight. Formatting that in a local
 * zone west of UTC rolls the displayed calendar day back to the 19th — so a
 * harvest date or an archival deadline silently reads as the day before for
 * anyone in the Americas. Date-only values are therefore formatted in UTC, and
 * real timestamps in the viewer's own zone, which is what they mean.
 *
 * `formatEta` in `readiness-format.ts` already pinned UTC for this reason.
 */
function zoneFor(value: string): string | undefined {
  return DATE_ONLY.test(value.trim()) ? "UTC" : undefined;
}

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "16 Jul 2026". The default for a date in a table or a detail row.
 * Returns the em-dash empty-cell marker for a missing value, which is the
 * table convention this codebase already uses (spec Decision 3).
 */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: typeof value === "string" ? zoneFor(value) : undefined,
  });
}

/** "16 Jul 2026, 14:30". For real timestamps where the time is meaningful, such
 *  as when an ingestion run started or a statement was submitted. */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Thousands-separated whole number, grouped the en-GB way ("1,234", never
 *  "1.234"). Same reason as the dates: two readers must agree on the value. */
export function formatNumber(value: string | number | null | undefined, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n.toLocaleString(LOCALE);
}
