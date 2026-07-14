"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api/client";
import { isWithinQuarter } from "@/lib/dashboard-worklist";
import type {
  BatchReadiness,
  DueDiligenceStatement,
  PaginatedResponse,
  ReadinessSummary,
  Supplier,
  TracesSubmission,
  TracesSubmissionStatus,
} from "@/lib/api/types";

/** Shared query keys — every Dashboard card hook below uses the SAME key
 * for the same underlying request, so React Query dedupes the network call
 * across cards that need it (e.g. the readiness list backs "Needs filing",
 * "Needs remediation"'s blocked POs, AND "Awaiting data" — one fetch, three
 * consumers) rather than each card re-fetching independently. */
const READINESS_ROWS_KEY = ["dashboard", "readiness-rows"];
const READINESS_SUMMARY_KEY = ["dashboard", "readiness-summary"];
const SUPPLIERS_LOOKUP_KEY = ["dashboard", "suppliers-lookup"];
const DDS_STATEMENTS_KEY = ["dashboard", "dds-statements"];
const LATEST_TRACES_SUBMISSIONS_KEY = ["dashboard", "traces-submissions-latest"];
const PLOTS_PENDING_KEY = ["dashboard", "plots-pending-validation-count"];

/** Every PO's derived readiness — no `stage`/`blocked` filter, so this hits
 * the readiness endpoint's fast DB-paginated path (see
 * `POReadinessListView.list`'s docstring) rather than the
 * compute-then-filter path. `page_size=100` is the same pilot-scale cap
 * used by the Sourcing list's own lookups (suppliers/products) — the
 * worklist needs every PO to bucket correctly, not one DataTable page. */
export function useReadinessRows() {
  return useQuery({
    queryKey: READINESS_ROWS_KEY,
    queryFn: async (): Promise<BatchReadiness[]> => {
      const res = await authFetch("/api/v1/supply-chain/batches/readiness/?page_size=100");
      if (!res.ok) throw new Error("Failed to load PO readiness");
      const body: PaginatedResponse<BatchReadiness> = await res.json();
      return body.results;
    },
    staleTime: 60_000,
  });
}

/** Org-wide readiness rollup (po_count/stage_counts/blocked_count/funnel,
 * tonnage normalised to KG) — backs the "POs in flight" and "Tonnes
 * uncovered" stat chips. */
export function useReadinessSummary() {
  return useQuery({
    queryKey: READINESS_SUMMARY_KEY,
    queryFn: async (): Promise<ReadinessSummary> => {
      const res = await authFetch("/api/v1/supply-chain/batches/readiness/summary/");
      if (!res.ok) throw new Error("Failed to load readiness summary");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/** Supplier id -> Supplier, resolved client-side exactly like the Sourcing
 * list's own `suppliersById` lookup (the readiness contract only carries
 * `seller_id`, not a joined name). */
export function useSuppliersLookup() {
  return useQuery({
    queryKey: SUPPLIERS_LOOKUP_KEY,
    queryFn: async (): Promise<Record<string, Supplier>> => {
      const res = await authFetch("/api/v1/suppliers/?page_size=100");
      if (!res.ok) throw new Error("Failed to load suppliers");
      const body: PaginatedResponse<Supplier> = await res.json();
      return Object.fromEntries(body.results.map((s) => [s.id, s]));
    },
    staleTime: 60_000,
  });
}

/** Every DDS (pilot-scale cap, same convention as above) — doubles as (a)
 * the id -> reference_number lookup the remediation card needs for a
 * rejected DDS's ref link, and (b) the "Statements filed this quarter" stat
 * (status === SUBMITTED and submitted_at falls in the current quarter;
 * `status` never reverts off SUBMITTED post-transport-success, ADR-0017,
 * so a since-rejected DDS still correctly counts as having been filed). */
export function useDdsStatements() {
  return useQuery({
    queryKey: DDS_STATEMENTS_KEY,
    queryFn: async (): Promise<DueDiligenceStatement[]> => {
      const res = await authFetch("/api/v1/due-diligence/statements/?page_size=100");
      if (!res.ok) throw new Error("Failed to load statements");
      const body: PaginatedResponse<DueDiligenceStatement> = await res.json();
      return body.results;
    },
    staleTime: 60_000,
  });
}

export function useStatementsFiledThisQuarter(): number {
  const { data: statements } = useDdsStatements();
  return useMemo(
    () => (statements ?? []).filter((s) => s.status === "SUBMITTED" && isWithinQuarter(s.submitted_at)).length,
    [statements]
  );
}

/** Plots pending validation — a plain count, fetched the same cheap way the
 * pre-#30 dashboard did (`page_size=1`; the paginator's `count` reflects
 * the full filtered total regardless of how many rows come back). */
export function usePlotsPendingValidationCount() {
  return useQuery({
    queryKey: PLOTS_PENDING_KEY,
    queryFn: async (): Promise<number> => {
      const res = await authFetch("/api/v1/geolocation/plots/?validation_status=PENDING&page_size=1");
      if (!res.ok) throw new Error("Failed to load plot validation counts");
      const body: PaginatedResponse<unknown> = await res.json();
      return body.count;
    },
    staleTime: 60_000,
  });
}

/** Lightweight shape actually returned by the bulk
 * `GET /api/v1/traces/submissions/` list endpoint
 * (`TracesSubmissionListSerializer`) — never `traces_status`/
 * `error_message` (those are detail-only). Mirrors the identical
 * `LatestSubmissionStub` in `app/(dashboard)/due-diligence/page.tsx` (#22) —
 * kept as a separate, dashboard-scoped type rather than a shared import per
 * this ticket's dashboard-only surface (that page is out of scope here). */
interface LatestSubmissionStub {
  id: string;
  dds_id: string;
  status: TracesSubmissionStatus;
}

async function fetchLatestSubmissionsByDds(): Promise<Map<string, LatestSubmissionStub>> {
  const byDds = new Map<string, LatestSubmissionStub>();
  const res = await authFetch("/api/v1/traces/submissions/?ordering=-created_at&page_size=100");
  if (!res.ok) return byDds; // degrade silently — never break the worklist over this.
  const data = await res.json().catch(() => null);
  const results: LatestSubmissionStub[] = Array.isArray(data?.results) ? data.results : [];
  for (const sub of results) {
    if (sub?.dds_id && !byDds.has(sub.dds_id)) byDds.set(sub.dds_id, sub);
  }
  return byDds;
}

async function fetchSubmissionDetail(id: string): Promise<TracesSubmission | null> {
  const res = await authFetch(`/api/v1/traces/submissions/${id}/`);
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export interface RejectedSubmission {
  dds_id: string;
  reason: string;
}

/** DDS ids whose LATEST TRACES submission was rejected — the "Needs
 * remediation" card's TRACES half. Same two-phase shape as the Submissions
 * hub (#22/ADR-0017): the bulk list never carries `traces_status`, so a row
 * whose pipeline `status` reached "SUBMITTED" (transport succeeded) gets a
 * follow-up detail fetch for the real regulator verdict; only THAT verdict
 * decides "Rejected", never the raw pipeline status. */
export function useRejectedTracesSubmissions(): { data: RejectedSubmission[]; isLoading: boolean } {
  const { data: latestByDds = new Map<string, LatestSubmissionStub>(), isLoading: latestLoading } = useQuery({
    queryKey: LATEST_TRACES_SUBMISSIONS_KEY,
    queryFn: fetchLatestSubmissionsByDds,
    staleTime: 60_000,
  });

  const pendingDetailIds = useMemo(
    () =>
      Array.from(
        new Set(Array.from(latestByDds.values()).filter((sub) => sub.status === "SUBMITTED").map((sub) => sub.id))
      ),
    [latestByDds]
  );

  const detailResults = useQueries({
    queries: pendingDetailIds.map((id) => ({
      queryKey: ["dashboard", "traces-submission-detail", id],
      queryFn: () => fetchSubmissionDetail(id),
      staleTime: 60_000,
    })),
  });

  const rejected = useMemo(() => {
    const rows: RejectedSubmission[] = [];
    for (const result of detailResults) {
      const detail = result.data;
      if (detail?.dds_id && detail.traces_status === "REJECTED") {
        rows.push({ dds_id: detail.dds_id, reason: detail.error_message || "Rejected by TRACES" });
      }
    }
    return rows;
  }, [detailResults]);

  const detailsLoading = detailResults.some((r) => r.isLoading);
  return { data: rejected, isLoading: latestLoading || detailsLoading };
}
