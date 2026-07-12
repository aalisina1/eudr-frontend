"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, FileQuestion, Plus } from "lucide-react";
import { DataTable, type ColumnDef, type FilterDef } from "@/components/data-table";
import { DDSForm } from "@/components/forms/dds-form";
import { authFetch } from "@/lib/api/client";
import type { DueDiligenceStatement, TracesSubmission, TracesSubmissionStatus } from "@/lib/api/types";
import { DDS_STATUS_STYLE } from "@/lib/dds-status";
import { deriveTracesDisplay, TRACES_DISPLAY_STYLE } from "@/lib/traces-status";

const RISK_LABEL: Record<string, string> = {
  NEGLIGIBLE: "Negligible",
  NOT_NEGLIGIBLE: "Not Negligible",
};

/**
 * Lightweight shape actually returned by the bulk `GET /api/v1/traces/submissions/`
 * list endpoint (`TracesSubmissionListSerializer`, backend) \u2014 it has the
 * pipeline `status` but never `traces_status`/`verification_number`/
 * `error_message` (those are detail-only). See the #22 PR notes: getting the
 * real regulator verdict per row needs a follow-up detail fetch below.
 */
interface LatestSubmissionStub {
  id: string;
  dds_id: string;
  status: TracesSubmissionStatus;
}

/**
 * One bulk, org-scoped fetch (pilot-scale \u2014 capped at 100) covering every DDS
 * on this list, regardless of which page/sort/filter DataTable is currently
 * showing. Ordered `-created_at` server-side, so the first result per
 * `dds_id` is that DDS's latest submission.
 */
async function fetchLatestSubmissionsByDds(): Promise<Map<string, LatestSubmissionStub>> {
  const byDds = new Map<string, LatestSubmissionStub>();
  const res = await authFetch(`/api/v1/traces/submissions/?ordering=-created_at&page_size=100`);
  if (!res.ok) return byDds; // degrade to internal DDS status \u2014 never break the list over this.
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

const filters: FilterDef[] = [
  {
    key: "status",
    label: "All Statuses",
    options: [
      { label: "Draft", value: "DRAFT" },
      { label: "Under Review", value: "UNDER_REVIEW" },
      { label: "Approved", value: "APPROVED" },
      { label: "Submitted", value: "SUBMITTED" },
      { label: "Rejected", value: "REJECTED" },
      { label: "Withdrawn", value: "WITHDRAWN" },
    ],
  },
  {
    key: "risk_conclusion",
    label: "All Risk Levels",
    options: [
      { label: "Negligible", value: "NEGLIGIBLE" },
      { label: "Not Negligible", value: "NOT_NEGLIGIBLE" },
    ],
  },
];

export default function DueDiligencePage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  // #22 / ADR-0017: the badge must reflect the DDS's latest TRACES
  // submission once one exists, not just the internal DDS status (which
  // stays SUBMITTED forever post-transport-success). One bulk fetch gives
  // the pipeline status (Submitting/Failed) for every row for free; rows
  // whose latest submission actually reached TRACES (pipeline SUBMITTED)
  // get a follow-up detail fetch for the real regulator verdict — the bulk
  // list serializer never carries `traces_status` (backend-confirmed; see
  // PR notes). Both queries degrade silently to the internal DDS status on
  // failure — this is progressive enhancement, never a hard dependency.
  const { data: latestByDds = new Map<string, LatestSubmissionStub>() } = useQuery({
    queryKey: ["traces-submissions", "latest-by-dds"],
    queryFn: fetchLatestSubmissionsByDds,
    staleTime: 60_000,
  });

  const pendingDetailIds = useMemo(
    () =>
      Array.from(
        new Set(
          Array.from(latestByDds.values())
            .filter((sub) => sub.status === "SUBMITTED")
            .map((sub) => sub.id),
        ),
      ),
    [latestByDds],
  );

  const detailResults = useQueries({
    queries: pendingDetailIds.map((id) => ({
      queryKey: ["traces-submissions", "detail", id],
      queryFn: () => fetchSubmissionDetail(id),
      staleTime: 60_000,
    })),
  });

  const detailByDds = useMemo(() => {
    const map = new Map<string, TracesSubmission>();
    for (const result of detailResults) {
      if (result.data?.dds_id) map.set(result.data.dds_id, result.data);
    }
    return map;
  }, [detailResults]);

  const columns = useMemo<ColumnDef<DueDiligenceStatement>[]>(
    () => [
      {
        key: "reference_number",
        header: "Reference",
        sortable: true,
        render: (stmt) => (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#E8C468]/10 flex items-center justify-center shrink-0">
              <FileText className="size-3.5 text-[#E8C468]" />
            </div>
            <span className="font-medium text-[13px] font-mono">{stmt.reference_number}</span>
          </div>
        ),
      },
      {
        key: "statement_type",
        header: "Type",
        render: (stmt) => (
          <span className="text-[13px] capitalize">{stmt.statement_type?.toLowerCase() || "—"}</span>
        ),
      },
      {
        key: "risk_conclusion",
        header: "Risk Conclusion",
        render: (stmt) =>
          stmt.risk_conclusion ? (
            <Badge
              variant="secondary"
              className={`border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5 ${
                stmt.risk_conclusion === "NEGLIGIBLE"
                  ? "bg-[#34D399]/10 text-[#1A6B5A]"
                  : "bg-[#C23D3D]/10 text-[#C23D3D]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  stmt.risk_conclusion === "NEGLIGIBLE" ? "bg-[#34D399]" : "bg-[#C23D3D]"
                }`}
              />
              {RISK_LABEL[stmt.risk_conclusion] ?? stmt.risk_conclusion}
            </Badge>
          ) : (
            <span className="text-muted-foreground">{"—"}</span>
          ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (stmt) => {
          // ADR-0017 contract: `traces_status ?? status` — the latest
          // TracesSubmission (detail, if we fetched it; else the bulk stub)
          // wins whenever it has something to say.
          const derivedKey = deriveTracesDisplay(detailByDds.get(stmt.id) ?? latestByDds.get(stmt.id));
          const ss = derivedKey ? TRACES_DISPLAY_STYLE[derivedKey] : (DDS_STATUS_STYLE[stmt.status] ?? DDS_STATUS_STYLE.DRAFT);
          return (
            <Badge variant="secondary" className={`${ss.bg} ${ss.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
              {ss.label}
            </Badge>
          );
        },
      },
      {
        key: "submitted_at",
        header: "Submitted",
        sortable: true,
        render: (stmt) => (
          <span className="text-muted-foreground text-[13px]">
            {stmt.submitted_at ? new Date(stmt.submitted_at).toLocaleDateString() : "—"}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "Created",
        sortable: true,
        render: (stmt) => (
          <span className="text-muted-foreground text-[13px]">
            {new Date(stmt.created_at).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [detailByDds, latestByDds],
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Submissions</h1>
          <p className="text-sm text-muted-foreground">EUDR compliance declarations</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New Statement
        </Button>
      </div>

      <DataTable<DueDiligenceStatement>
        queryKey="due-diligence"
        endpoint="/api/v1/due-diligence/statements/"
        columns={columns}
        filters={filters}
        searchPlaceholder="Search by reference number..."
        exportable
        rowKey={(stmt) => stmt.id}
        onRowClick={(stmt) => router.push(`/due-diligence/${stmt.id}`)}
        emptyIcon={<FileQuestion className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No statements yet"
        emptyDescription="Create a due diligence statement to declare your supply chain is deforestation-free"
      />

      <DDSForm
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
