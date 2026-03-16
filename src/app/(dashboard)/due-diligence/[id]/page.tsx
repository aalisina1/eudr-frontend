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
import { ArrowLeft, Pencil, FileText } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { DDSForm } from "@/components/forms/dds-form";
import type { DueDiligenceStatement, DDSStatus } from "@/lib/api/types";

const STATUS_STYLE: Record<DDSStatus, { bg: string; text: string; dot: string; label: string }> = {
  DRAFT: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Draft" },
  UNDER_REVIEW: { bg: "bg-[#C7956D]/10", text: "text-[#A07850]", dot: "bg-[#C7956D]", label: "Under Review" },
  APPROVED: { bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", dot: "bg-[#34D399]", label: "Approved" },
  SUBMITTED: { bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", label: "Submitted" },
  REJECTED: { bg: "bg-[#C23D3D]/10", text: "text-[#C23D3D]", dot: "bg-[#C23D3D]", label: "Rejected" },
  WITHDRAWN: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Withdrawn" },
};

const TH = "text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

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
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !stmt) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => router.push("/due-diligence")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          Statement not found or failed to load.
        </div>
      </div>
    );
  }

  const ss = STATUS_STYLE[stmt.status] ?? STATUS_STYLE.DRAFT;
  const canEdit = stmt.status === "DRAFT" || stmt.status === "REJECTED";
  const isPending = actionMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/due-diligence")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Due Diligence
        </Button>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8C468]/10 flex items-center justify-center">
              <FileText className="size-5 text-[#E8C468]" />
            </div>
            <div>
              <h1 className="text-xl font-medium font-mono">{stmt.reference_number}</h1>
              <p className="text-sm text-muted-foreground capitalize">{stmt.statement_type.toLowerCase()} statement</p>
            </div>
          </div>
          <Badge variant="secondary" className={`${ss.bg} ${ss.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
            {ss.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Risk Conclusion</p>
            <p className="text-xs">
              {stmt.risk_conclusion
                ? stmt.risk_conclusion === "NEGLIGIBLE" ? "Negligible" : "Not Negligible"
                : "Not assessed"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">TRACES Reference</p>
            <p className="text-xs font-mono">{stmt.traces_reference || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Submitted</p>
            <p className="text-xs">{stmt.submitted_at ? new Date(stmt.submitted_at).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Valid Until</p>
            <p className="text-xs">{stmt.valid_until ? new Date(stmt.valid_until).toLocaleDateString() : "—"}</p>
          </div>
        </div>

        {stmt.conclusion_justification && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-muted-foreground text-xs mb-1">Justification</p>
            <p className="text-sm">{stmt.conclusion_justification}</p>
          </div>
        )}
      </div>

      {/* State Actions */}
      <div className="flex flex-wrap gap-2">
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
        {actionMutation.error && (
          <span className="text-xs text-destructive self-center">{(actionMutation.error as Error).message}</span>
        )}
      </div>

      {/* Risk Assessments */}
      <div>
        <h2 className="text-sm font-medium mb-3">Risk Assessments</h2>
        {stmt.risk_assessments && stmt.risk_assessments.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
          <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No risk assessments yet</p>
          </div>
        )}
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
