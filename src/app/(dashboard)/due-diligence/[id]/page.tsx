"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Pencil } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { DDSForm } from "@/components/forms/dds-form";
import type { ActivityType, DueDiligenceStatement } from "@/lib/api/types";
import { DDS_STATUS_STYLE } from "@/lib/dds-status";
import { TracesPanel } from "@/components/traces/traces-panel";

const TH = "text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  DOMESTIC: "Domestic production",
  IMPORT: "Import",
  EXPORT: "Export",
};

/** Some seeded/legacy statements carry an empty `activity_type` (not one of
 * the typed enum values) — degrade to "—" rather than rendering blank. */
function activityLabel(activityType: DueDiligenceStatement["activity_type"]): string {
  return ACTIVITY_LABEL[activityType] ?? "—";
}

/** Label + value row for the "Statement details" meta grid — the mono,
 * uppercase label / plain value pairing is ported from the Claude Design
 * prototype's `MetaRow` (dds-detail/page.jsx). */
function MetaRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <>
      <span className="self-center font-mono text-[10.5px] tracking-[0.08em] uppercase text-muted-foreground">
        {label}
      </span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value}</span>
    </>
  );
}

export default function DDSDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: stmt, isLoading, error } = useQuery<DueDiligenceStatement>({
    queryKey: ["dds", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/due-diligence/statements/${id}/`);
      if (!res.ok) throw new Error("Failed to fetch statement");
      return res.json();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await authFetch(`/api/v1/due-diligence/statements/${id}/${action}/`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to ${action}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dds", id] });
      queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/due-diligence/statements/${id}/`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
      router.push("/due-diligence");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !stmt) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => router.push("/due-diligence")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          Statement not found or failed to load.
        </div>
      </div>
    );
  }

  const ss = DDS_STATUS_STYLE[stmt.status] ?? DDS_STATUS_STYLE.DRAFT;
  const StatusIcon = ss.icon;
  const canEdit = stmt.status === "DRAFT" || stmt.status === "REJECTED";
  const isPending = actionMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/due-diligence")} className="gap-1.5 -ml-2">
        <ArrowLeft className="size-4" /> Submissions
      </Button>

      {/* Eyebrow + display header + status badge row */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-muted-foreground mb-2.5">
            Due diligence statement
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-display text-4xl leading-[1.04] italic font-light">{stmt.reference_number}</h1>
            <Badge variant="secondary" className={`${ss.bg} ${ss.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
              <StatusIcon className="size-3" />
              {ss.label}
            </Badge>
          </div>
          <p className="mt-2.5 text-[15px] text-muted-foreground capitalize">
            {stmt.statement_type.toLowerCase()} statement · {activityLabel(stmt.activity_type)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
          {(stmt.status === "DRAFT" || stmt.status === "REJECTED") && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => actionMutation.mutate("submit-for-review")}
            >
              Submit for Review
            </Button>
          )}
          {stmt.status === "UNDER_REVIEW" && (
            <>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => actionMutation.mutate("approve")}
                className="bg-[#34D399] hover:bg-[#2CB889] text-white"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => actionMutation.mutate("reject")}
              >
                Reject
              </Button>
            </>
          )}
          {stmt.status === "SUBMITTED" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => actionMutation.mutate("withdraw")}
            >
              Withdraw
            </Button>
          )}
          {stmt.status === "DRAFT" && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => { if (confirm("Delete this draft?")) deleteMutation.mutate(); }}
            >
              Delete Draft
            </Button>
          )}
        </div>
      </header>
      {actionMutation.error && (
        <p className="text-xs text-destructive -mt-4">{(actionMutation.error as Error).message}</p>
      )}

      {/* Two-column layout: statement details + risk assessments (left), TRACES submission (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card">
            <h2 className="text-base font-medium mb-4">Statement details</h2>
            <div className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3.5">
              <MetaRow label="Activity" value={activityLabel(stmt.activity_type)} />
              <MetaRow
                label="Risk Conclusion"
                value={
                  stmt.risk_conclusion
                    ? stmt.risk_conclusion === "NEGLIGIBLE" ? "Negligible" : "Not Negligible"
                    : "Not assessed"
                }
              />
              <MetaRow label="TRACES Reference" value={stmt.traces_reference || "—"} mono />
              <MetaRow
                label="Submitted"
                value={stmt.submitted_at ? new Date(stmt.submitted_at).toLocaleDateString() : "—"}
              />
              <MetaRow
                label="Valid Until"
                value={stmt.valid_until ? new Date(stmt.valid_until).toLocaleDateString() : "—"}
              />
            </div>

            {stmt.conclusion_justification && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-muted-foreground text-xs mb-1">Justification</p>
                <p className="text-sm">{stmt.conclusion_justification}</p>
              </div>
            )}
          </div>

          {/* Risk Assessments */}
          <div>
            <h2 className="text-sm font-medium mb-3">Risk Assessments</h2>
            {stmt.risk_assessments && stmt.risk_assessments.length > 0 ? (
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className={TH}>Country Risk</TableHead>
                      <TableHead className={TH}>Deforestation</TableHead>
                      <TableHead className={TH}>Legality</TableHead>
                      <TableHead className={TH}>Traceability</TableHead>
                      <TableHead className={TH}>Conclusion</TableHead>
                      <TableHead className={TH}>Assessed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stmt.risk_assessments.map((ra) => (
                      <TableRow key={ra.id} className="border-border/30">
                        <TableCell className="text-[13px]">{ra.country_risk}</TableCell>
                        <TableCell className="text-[13px]">{ra.deforestation_risk_score}</TableCell>
                        <TableCell className="text-[13px]">{ra.legality_risk_score}</TableCell>
                        <TableCell className="text-[13px]">{ra.traceability_completeness}%</TableCell>
                        <TableCell className="text-[13px]">{ra.overall_conclusion || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-[13px]">
                          {new Date(ra.assessed_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
                <p className="text-sm text-muted-foreground">No risk assessments yet</p>
              </div>
            )}
          </div>
        </div>

        {/* TRACES submission */}
        <div className="min-w-0">
          <TracesPanel
            ddsId={id}
            ddsStatus={stmt.status}
            activityType={stmt.activity_type}
            ddsCreatedAt={stmt.created_at}
          />
        </div>
      </div>

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground flex gap-4">
        <span>Created: {new Date(stmt.created_at).toLocaleDateString()}</span>
        <span>Updated: {new Date(stmt.updated_at).toLocaleDateString()}</span>
      </div>

      <DDSForm open={editOpen} onOpenChange={setEditOpen} statement={stmt} />
    </div>
  );
}
