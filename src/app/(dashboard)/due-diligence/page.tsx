"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, FileQuestion, Plus } from "lucide-react";
import { DataTable, type ColumnDef, type FilterDef } from "@/components/data-table";
import { FileDdsComposer } from "@/components/due-diligence/file-dds-composer";
import { authFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { DueDiligenceStatement, TracesSubmission, TracesSubmissionStatus } from "@/lib/api/types";
import { DDS_STATUS_STYLE } from "@/lib/dds-status";
import { deriveTracesDisplay, TRACES_DISPLAY_STYLE } from "@/lib/traces-status";
import { formatDate } from "@/lib/format";

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
    key: "risk_conclusion",
    label: "All Risk Levels",
    options: [
      { label: "Negligible", value: "NEGLIGIBLE" },
      { label: "Not Negligible", value: "NOT_NEGLIGIBLE" },
    ],
  },
];

// `status` moves out of the generic `FilterDef` array (dashboard-redesign
// filtering addendum, Task 7.3): FilterDef's `activeFilters` state lives
// inside `DataTable` with no way to pass an initial value in, so it can't be
// seeded from a URL param. Mirrors `/shipments`'s own `?rag=RED` deep-link
// pattern — a plain toolbar `<select>` backed by page-level state, fed into
// `extraParams` instead.
const STATUS_OPTIONS: { value: DueDiligenceStatement["status"] | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

/** `useSearchParams()` requires a Suspense boundary to avoid a full
 * client-side-render bailout for this route (Next.js App Router) — the
 * actual page body lives in `DueDiligencePageInner` below. */
export default function DueDiligencePage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-72" />}>
      <DueDiligencePageInner />
    </Suspense>
  );
}

function DueDiligencePageInner() {
  const router = useRouter();

  // #26 — the `?po=` deep-link target (from PO Detail's "File DDS" CTA,
  // `src/app/(dashboard)/supply-chains/[id]/page.tsx`) takes over this whole
  // route with the full-page File DDS composer instead of the Submissions
  // list. `poId` is read here (not inside a conditional hook) so every hook
  // below still runs in the same order on every render — Rules of Hooks —
  // the composer branch below is a return, not a skipped hook call; the
  // list's own queries are merely `enabled: !poId` so they don't fire a
  // wasted fetch while the composer is showing.
  const searchParams = useSearchParams();
  const poId = searchParams.get("po");
  const consignmentId = searchParams.get("consignment");

  // Dashboard Tier 4d's "Filed DDS expiring < 90 days" doorway deep-links
  // here as `/due-diligence?status=SUBMITTED` — seed the status toolbar
  // filter from the URL. An absent or unrecognized value degrades to ""
  // (no filter, full list), never a crash. Sorting toward the soonest
  // `valid_until` was evaluated and found infeasible frontend-only — see
  // this task's docstring above and the plan's Global Constraints.
  const statusParam = searchParams.get("status") ?? "";
  const [status, setStatus] = useState(
    STATUS_OPTIONS.some((o) => o.value === statusParam) ? statusParam : ""
  );

  const extraParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (status) p.status = status;
    return p;
  }, [status]);

  const toolbarExtra = (
    <select
      aria-label="Status"
      value={status}
      onChange={(e) => setStatus(e.target.value)}
      className="h-9 cursor-pointer appearance-none rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

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
    enabled: !poId && !consignmentId,
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
            <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <FileText className="size-3.5 text-warning" />
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
                  ? "bg-success/10 text-success-foreground"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  stmt.risk_conclusion === "NEGLIGIBLE" ? "bg-success" : "bg-destructive"
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
          const StatusIcon = ss.icon;
          return (
            <Badge variant="secondary" className={`${ss.bg} ${ss.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
              <StatusIcon className={`size-3 ${ss.spin ? "animate-spin" : ""}`} />
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
            {stmt.submitted_at ? formatDate(stmt.submitted_at) : "—"}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "Created",
        sortable: true,
        render: (stmt) => (
          <span className="text-muted-foreground text-[13px]">
            {formatDate(stmt.created_at)}
          </span>
        ),
      },
    ],
    [detailByDds, latestByDds],
  );

  if (consignmentId) {
    return <FileDdsComposer consignmentId={consignmentId} />;
  }
  if (poId) {
    return <FileDdsComposer poId={poId} />;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-display text-4xl leading-[1.04] italic font-light">Submissions</h1>
          <p className="mt-2.5 text-[15px] text-muted-foreground">Statements submitted to the EU TRACES registry.</p>
        </div>
        {/* A statement is composed from a purchase order and its lots — that
            is the only path that can produce one TRACES will accept, since
            `commodities` is mandatory in the XSD. The button that used to sit
            here opened a form with no lot selection and produced statements
            that could never be filed (eudr-frontend#104). */}
        <Link href="/supply-chains" className={cn(buttonVariants(), "gap-1.5")}>
          <Plus className="size-4" />
          File from a purchase order
        </Link>
      </header>

      <DataTable<DueDiligenceStatement>
        queryKey="due-diligence"
        endpoint="/api/v1/due-diligence/statements/"
        columns={columns}
        filters={filters}
        extraParams={extraParams}
        toolbarExtra={toolbarExtra}
        searchPlaceholder="Search by reference number..."
        exportable
        rowKey={(stmt) => stmt.id}
        onRowClick={(stmt) => router.push(`/due-diligence/${stmt.id}`)}
        emptyIcon={<FileQuestion className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No statements yet"
        emptyDescription="Statements are filed from a purchase order. Open Sourcing and pick one that is ready to file."
      />

    </div>
  );
}
