"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { isInFlight } from "@/lib/traces-status";
import type { TracesSubmission } from "@/lib/api/types";

/** GET on the list endpoint returns the lightweight serializer (no
 * `traces_status` / `verification_number` / `error_message` / `error_detail`)
 * — follow up with a detail GET by id so callers have the full row. */
async function fetchLatestSubmission(ddsId: string): Promise<TracesSubmission | null> {
  const listRes = await authFetch(
    `/api/v1/traces/submissions/?dds_id=${ddsId}&ordering=-created_at`,
  );
  if (!listRes.ok) throw new Error(getErrorMessage(await listRes.json().catch(() => ({}))));
  const listData = await listRes.json();
  const latestId = listData.results?.[0]?.id as string | undefined;
  if (!latestId) return null;

  const detailRes = await authFetch(`/api/v1/traces/submissions/${latestId}/`);
  if (!detailRes.ok) throw new Error(getErrorMessage(await detailRes.json().catch(() => ({}))));
  return detailRes.json();
}

/** True while the submission is mid-flight, so the query polls itself. */
function isPendingRow(sub: TracesSubmission | null): boolean {
  if (!sub) return false;
  if (sub.status === "FAILED") return false;
  return isInFlight(sub.status) || sub.traces_status === "SUBMITTED";
}

/**
 * The most recent TRACES call made for a statement.
 *
 * Shared under one `["traces-submission", ddsId]` key so the panel that acts
 * on it and the page header that has to know whether a filing exists at all
 * read the same row from one fetch — rather than the page guessing from
 * `DueDiligenceStatement.status`, which says a statement was submitted but
 * not whether TRACES still holds it.
 */
export function useLatestTracesSubmission(ddsId: string) {
  return useQuery({
    queryKey: ["traces-submission", ddsId],
    queryFn: () => fetchLatestSubmission(ddsId),
    refetchInterval: (query) => (isPendingRow(query.state.data ?? null) ? 3000 : false),
  });
}
