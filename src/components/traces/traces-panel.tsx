"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/api/client";
import type { TracesSubmission } from "@/lib/api/types";

/** TRACES-assigned lifecycle status styling (AVAILABLE is the success state, never "Accepted"). */
const TRACES_STATUS_STYLE: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  SUBMITTED: { label: "Submitting", bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]" },
  AVAILABLE: { label: "Available", bg: "bg-[#34D399]/10", text: "text-[#1B7A5A]", dot: "bg-[#34D399]" },
  REJECTED: { label: "Rejected", bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
  WITHDRAWN: { label: "Withdrawn", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  GROUPED: { label: "Grouped", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  ARCHIVED: { label: "Archived", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const IN_FLIGHT = new Set(["QUEUED", "PROCESSING"]);

function isPending(sub: TracesSubmission | null): boolean {
  if (!sub) return false;
  return sub.traces_status === "SUBMITTED" || IN_FLIGHT.has(sub.status);
}

async function fetchLatestSubmission(ddsId: string): Promise<TracesSubmission | null> {
  const res = await authFetch(
    `/api/v1/traces/submissions/?dds_id=${ddsId}&ordering=-created_at`,
  );
  if (!res.ok) throw new Error("Failed to load TRACES submission");
  const data = await res.json();
  return (data.results?.[0] as TracesSubmission | undefined) ?? null;
}

async function fetchHasCredentials(): Promise<boolean> {
  const res = await authFetch(`/api/v1/traces/credentials/`);
  if (!res.ok) return false;
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.results ?? []);
  return list.length > 0;
}

/** Show the regulator's 72-hour amendment window on an AVAILABLE submission. */
function AmendWindow({ submittedAt }: { submittedAt: string | null }) {
  // Capture "now" once at mount (keeps render pure — no Date.now() in the render body).
  const [now] = useState(() => Date.now());
  if (!submittedAt) return null;
  const msLeft = new Date(submittedAt).getTime() + 72 * 3_600_000 - now;
  if (msLeft > 0) {
    const hours = Math.floor(msLeft / 3_600_000);
    const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
    return (
      <p className="text-xs text-muted-foreground">
        Amendment window:{" "}
        <span className="font-medium text-foreground">
          {hours}h {minutes}m
        </span>{" "}
        left to amend and keep the same reference number.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Amendment window closed — a correction now files a new submission with a new reference number.
    </p>
  );
}

function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1 font-mono text-xs hover:bg-secondary"
        aria-label={`Copy ${label}`}
      >
        {value}
        {copied ? <Check className="size-3 text-[#34D399]" /> : <Copy className="size-3 opacity-50" />}
      </button>
    </div>
  );
}

export function TracesPanel({ ddsId, activityType }: { ddsId: string; activityType?: string }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: submission, isLoading } = useQuery({
    queryKey: ["traces-submission", ddsId],
    queryFn: () => fetchLatestSubmission(ddsId),
    refetchInterval: (query) => (isPending(query.state.data ?? null) ? 3000 : false),
  });

  const { data: hasCreds } = useQuery({
    queryKey: ["traces-credentials"],
    queryFn: fetchHasCredentials,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/traces/submissions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dds_id: ddsId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["traces-submission", ddsId] });
      queryClient.invalidateQueries({ queryKey: ["dds", ddsId] });
    },
  });

  const status = submission?.traces_status ?? "";
  const style = TRACES_STATUS_STYLE[status];
  const pending = isPending(submission ?? null);
  const canResubmit = !submission || status === "REJECTED";

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
          TRACES Submission
        </h2>
        {style && (
          <Badge
            variant="secondary"
            className={`${style.bg} ${style.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            )}
            {style.label}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : status === "AVAILABLE" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-6">
            <CopyChip label="Reference Number" value={submission!.traces_reference_number} />
            <CopyChip label="Verification Number" value={submission!.verification_number} />
          </div>
          <AmendWindow submittedAt={submission!.submitted_at} />
        </div>
      ) : status === "REJECTED" ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive border border-destructive/15">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{submission!.error_message || "TRACES rejected the submission."}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Fix the issue on the underlying batches/plots, then resubmit.
          </p>
        </div>
      ) : pending ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Submitting to TRACES — waiting for acceptance…
        </p>
      ) : status === "WITHDRAWN" || status === "GROUPED" || status === "ARCHIVED" ? (
        <p className="text-sm text-muted-foreground">
          {status === "WITHDRAWN"
            ? "This DDS was withdrawn from TRACES."
            : status === "GROUPED"
              ? "This DDS is grouped under another submission."
              : "This DDS is archived in TRACES."}
          {submission!.traces_reference_number && (
            <span className="ml-1 font-mono">({submission!.traces_reference_number})</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not submitted to TRACES.</p>
      )}

      {canResubmit && !pending && (
        <div className="mt-4">
          <Button
            size="sm"
            disabled={hasCreds === false}
            onClick={() => setConfirmOpen(true)}
            className="gap-1.5"
          >
            <Send className="size-3.5" />
            {status === "REJECTED" ? "Resubmit to TRACES" : "Submit to TRACES"}
          </Button>
          {hasCreds === false && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Configure TRACES credentials first (Settings → TRACES connection).
            </p>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit this DDS to TRACES?</DialogTitle>
            <DialogDescription>
              This files the Due Diligence Statement to the EU TRACES{" "}
              <span className="font-medium">Acceptance</span> environment as a{" "}
              <span className="font-medium">{(activityType || "DOMESTIC").toLowerCase()}</span>{" "}
              activity. This is a regulated action.
            </DialogDescription>
          </DialogHeader>
          {submitMutation.isError && (
            <p className="text-sm text-destructive">{submitMutation.error.message}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className="gap-1.5"
            >
              {submitMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Submit to TRACES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
