import { AlertTriangle, CheckCircle2, FileText, Loader2, Send, XCircle, type LucideIcon } from "lucide-react";
import type { TracesSubmission, TracesSubmissionStatus } from "@/lib/api/types";

/**
 * Derived TRACES-submission display state — collapses the internal pipeline
 * `status` (QUEUED/PROCESSING/SUBMITTED/FAILED/RETRYING) and the
 * TRACES-assigned `traces_status` (SUBMITTED/AVAILABLE/REJECTED/WITHDRAWN/
 * GROUPED/ARCHIVED) into one badge state.
 *
 * ADR-0017: a DDS's displayed status post-submission must derive from its
 * latest `TracesSubmission`, never echo `dds.status` raw — `dds.status`
 * flips to `SUBMITTED` once and stays there forever once the transport
 * succeeds (`apps/traces_integration/submit.py` `perform_submit`), even if
 * TRACES later rejects the statement. This module is what makes the
 * Submissions list badge (`due-diligence/page.tsx`, #22) tell that story.
 *
 * This mirrors `deriveDisplay`/`STATUS_META` in
 * `components/traces/traces-panel.tsx` (the DDS-detail panel, shipped in
 * #2/PR#35) but is kept as a separate, list-scoped definition rather than a
 * shared import — that panel just landed fully tested and this ticket
 * doesn't need to touch it. Consolidating both call sites onto one module is
 * a reasonable follow-up once both have settled.
 */
export type TracesDisplayKey =
  | "submitting"
  | "submitted"
  | "available"
  | "rejected"
  | "failed"
  | "withdrawn"
  | "grouped"
  | "archived";

/** Pipeline states that mean "still in flight, no verdict yet" (ADR-0017:
 * QUEUED/PROCESSING/RETRYING all map to "Submitting…", covering the entire
 * time a submission attempt is active, including transient failures being
 * retried — never falls back to raw dds.status during these states).
 *
 * #41: this used to be hand-rolled a second time in `traces-panel.tsx`, and
 * RETRYING was independently missed (then re-added) in both copies across
 * three separate QA passes before they were merged into this one set —
 * exported via `isInFlight()` below as the single source of truth every
 * surface must consume instead of redeclaring its own copy. */
const IN_FLIGHT = new Set<TracesSubmissionStatus>(["QUEUED", "PROCESSING", "RETRYING"]);

/** Is a TRACES submission's pipeline `status` still in flight (no verdict
 * yet)? ADR-0017's state table: QUEUED/PROCESSING/RETRYING are all "still
 * trying" (→ "Submitting…"); SUBMITTED means transport succeeded (verdict
 * comes from `traces_status` instead); FAILED is terminal. */
export function isInFlight(status: TracesSubmissionStatus): boolean {
  return IN_FLIGHT.has(status);
}

export const TRACES_DISPLAY_STYLE: Record<
  TracesDisplayKey,
  { bg: string; text: string; dot: string; label: string; icon: LucideIcon; spin?: boolean }
> = {
  submitting: { bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", label: "Submitting", icon: Loader2, spin: true },
  submitted: { bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", label: "Submitted", icon: Send },
  available: { bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", dot: "bg-[#34D399]", label: "Available", icon: CheckCircle2 },
  rejected: { bg: "bg-[#C23D3D]/10", text: "text-[#C23D3D]", dot: "bg-[#C23D3D]", label: "Rejected", icon: AlertTriangle },
  failed: { bg: "bg-[#C23D3D]/10", text: "text-[#C23D3D]", dot: "bg-[#C23D3D]", label: "Failed", icon: AlertTriangle },
  withdrawn: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Withdrawn", icon: XCircle },
  grouped: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Grouped", icon: FileText },
  archived: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Archived", icon: FileText },
};

/**
 * Derive the badge key for a DDS's latest `TracesSubmission`, or `null` if
 * there isn't one yet (or it has nothing to add beyond the DDS's own
 * status) — callers fall back to the internal `DDS_STATUS_STYLE` in that
 * case. `sub` is intentionally a partial pick: the *bulk* list endpoint
 * (`GET /api/v1/traces/submissions/`) only ever returns the lightweight
 * `status` (pipeline) field, never `traces_status` — see the #22 PR notes
 * for why the regulator-side states below require a follow-up detail fetch.
 */
export function deriveTracesDisplay(
  sub: Pick<TracesSubmission, "status"> & Partial<Pick<TracesSubmission, "traces_status">> | null | undefined,
): TracesDisplayKey | null {
  if (!sub) return null;
  if (sub.traces_status === "AVAILABLE") return "available";
  if (sub.traces_status === "REJECTED") return "rejected";
  if (sub.traces_status === "WITHDRAWN") return "withdrawn";
  if (sub.traces_status === "GROUPED") return "grouped";
  if (sub.traces_status === "ARCHIVED") return "archived";
  if (sub.traces_status === "SUBMITTED") return "submitted";
  if (sub.status === "FAILED") return "failed";
  if (isInFlight(sub.status)) return "submitting";
  return null;
}
