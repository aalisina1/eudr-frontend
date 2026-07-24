/** Pure display/derivation helpers for the shipments (consignment) surfaces.
 * No fetch/framework deps — mirrors readiness-format.ts's role for sourcing. */
import type { TrackingState } from "@/lib/api/types";

/** Whole-percent coverage; 0 for an empty consignment (avoid NaN). */
export function coveragePct(covered: number, total: number): number {
  return total > 0 ? Math.round((covered / total) * 100) : 0;
}

/** Tracking state for TrackingBadge. A backend-supplied `tracking_state` wins;
 * otherwise derive the observable subset. ERROR / QUOTA_REACHED are NOT
 * distinguishable from the current PR-B contract fields (no error signal), so
 * they only appear when the backend supplies `tracking_state` — see the
 * TrackingState note in api/types.ts. */
export function deriveTrackingState(c: {
  tracking_number: string | null;
  t49_request_id?: string | null;
  latest_eta: string | null;
  tracking_state?: TrackingState | null;
}): TrackingState {
  if (c.tracking_state) return c.tracking_state;
  if (!c.tracking_number) return "untracked";
  if (c.latest_eta) return "live";
  return "subscribing";
}

/** "vessel_departed" → "Vessel departed" — display label for feed event types. */
export function humanizeEventType(s: string): string {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
