import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";

/**
 * Cron helpers for the ingestion schedule editor.
 *
 * The backend (`IngestionScheduleSerializer.validate`) accepts only a 5-field
 * cron expression for an enabled schedule, so these helpers enforce exactly 5
 * fields — cron-parser would otherwise also accept the 6-field (with-seconds)
 * form, which the backend rejects.
 */

function hasFiveFields(expr: string): boolean {
  return Boolean(expr) && expr.trim().split(/\s+/).length === 5;
}

/** True only for a parseable, exactly-5-field cron expression. */
export function isValidCron(expr: string): boolean {
  if (!hasFiveFields(expr)) return false;
  try {
    CronExpressionParser.parse(expr.trim());
    return true;
  } catch {
    return false;
  }
}

/** Human-readable, 24h description (e.g. "At 02:00, only on Monday"), or null if invalid. */
export function describeCron(expr: string): string | null {
  if (!isValidCron(expr)) return null;
  try {
    return cronstrue.toString(expr.trim(), {
      use24HourTimeFormat: true,
      verbose: false,
    });
  } catch {
    return null;
  }
}

/** Next fire time for the expression in the given IANA timezone, or null if invalid. */
export function getNextRun(
  expr: string,
  timezone = "UTC",
  from?: Date,
): Date | null {
  if (!isValidCron(expr)) return null;
  try {
    const interval = CronExpressionParser.parse(expr.trim(), {
      tz: timezone,
      currentDate: from ?? new Date(),
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}
