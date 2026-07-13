"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
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
import { getErrorMessage } from "@/lib/api/errors";
import type { DDSStatus, TracesErrorDetail, TracesSubmission } from "@/lib/api/types";

/**
 * Local, derived display state for the panel — collapses the internal
 * pipeline `status` (QUEUED/PROCESSING/SUBMITTED/FAILED/RETRYING) and the
 * TRACES-assigned `traces_status` (SUBMITTED/AVAILABLE/REJECTED/WITHDRAWN/
 * GROUPED/ARCHIVED) into one set of badge/copy states so the rest of the
 * component never has to reason about both fields at once.
 */
type DisplayKey =
  | "not_submitted"
  | "submitting"
  | "submitted"
  | "available"
  | "rejected"
  | "failed"
  | "withdrawn"
  | "grouped"
  | "archived";

const STATUS_META: Record<
  DisplayKey,
  { label: string; bg: string; text: string; dot: string; pending?: boolean }
> = {
  not_submitted: { label: "Not submitted", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  submitting: { label: "Submitting…", bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", pending: true },
  submitted: { label: "Submitted", bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", pending: true },
  available: { label: "Available", bg: "bg-[#34D399]/10", text: "text-[#1B7A5A]", dot: "bg-[#34D399]" },
  rejected: { label: "Rejected", bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
  failed: { label: "Failed", bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
  withdrawn: { label: "Withdrawn", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  grouped: { label: "Grouped", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  archived: { label: "Archived", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

// ADR-0017's FE derivation table: status ∈ {QUEUED, PROCESSING, RETRYING} → "Submitting…".
// RETRYING is a real TracesSubmission.Status member (the backend's own dedup
// check treats it as in-flight) — omitting it here both mis-renders a
// retrying submission as "Not submitted" (with an active Submit button) and
// silently stops refetchInterval polling, which gates on isPending().
const IN_FLIGHT = new Set(["QUEUED", "PROCESSING", "RETRYING"]);

/** Derive the single display state a submission (or its absence) maps to. */
function deriveDisplay(sub: TracesSubmission | null): DisplayKey {
  if (!sub) return "not_submitted";
  if (sub.traces_status === "AVAILABLE") return "available";
  if (sub.traces_status === "REJECTED") return "rejected";
  if (sub.traces_status === "WITHDRAWN") return "withdrawn";
  if (sub.traces_status === "GROUPED") return "grouped";
  if (sub.traces_status === "ARCHIVED") return "archived";
  if (sub.traces_status === "SUBMITTED") return "submitted";
  if (sub.status === "FAILED") return "failed";
  if (IN_FLIGHT.has(sub.status)) return "submitting";
  return "not_submitted";
}

function isPending(sub: TracesSubmission | null): boolean {
  return !!STATUS_META[deriveDisplay(sub)].pending;
}

/** GET returns the lightweight list serializer (no `traces_status` /
 * `verification_number` / `error_message` / `error_detail`) — follow up
 * with a detail GET by id so the panel has the full row to render. */
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

/** Structured per-field errors (#63 / eudr-app PR#67) — render each entry,
 * not a flattened string. Falls back to `error_message` only if the
 * submission has no `error_detail` rows (e.g. an older row, or a getDds
 * SOAP fault outside the payload-validation gate). */
function ErrorDetail({ submission, display }: { submission: TracesSubmission; display: DisplayKey }) {
  const details: TracesErrorDetail[] = submission.error_detail ?? [];
  if (details.length === 0) {
    // "failed" (our pipeline gave up — validation gate or exhausted transport
    // retries) is not the same claim as "rejected" (TRACES itself returned a
    // business rejection) — don't say TRACES rejected something it may never
    // have seen.
    const fallback =
      display === "rejected" ? "TRACES rejected the submission." : "The submission failed before TRACES could process it.";
    return (
      <div className="flex items-start gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive border border-destructive/15">
        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
        <span>{submission.error_message || fallback}</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {details.map((d, i) => (
        <div
          key={`${d.field}-${i}`}
          className="flex items-start gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive border border-destructive/15"
        >
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <div>
            <span className="block font-mono text-xs font-medium">{d.field}</span>
            <span>{d.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface TimelineStep {
  title: string;
  meta: string;
  icon: typeof FileText;
  state: "done" | "current" | "pending" | "error";
}

/** TRACES timeline step — ported from the Claude Design prototype's
 * `TimelineStep` (dds-detail/page.jsx): a 28px icon roundel (filled/tinted
 * when done, dashed-outline when pending) connected by a vertical rule, a
 * semibold title, and mono meta text. Visual only — `state` (done/current/
 * pending/error) and its derivation in `buildTimeline` are unchanged. */
function TimelineRow({ step, last }: { step: TimelineStep; last: boolean }) {
  const dim = step.state === "pending";
  const iconClass =
    step.state === "error"
      ? "bg-destructive/10 text-destructive"
      : step.state === "done"
        ? "bg-primary/10 text-primary"
        : step.state === "current"
          ? "bg-[#E8C468]/15 text-[#9A7D2E]"
          : "border border-dashed border-border text-muted-foreground";
  return (
    <div className={`flex gap-3 ${dim ? "opacity-55" : ""}`}>
      <div className="flex flex-col items-center">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
          {step.state === "current" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <step.icon className="size-3.5" />
          )}
        </span>
        {!last && <span className="my-1 w-0.5 flex-1 bg-border rounded-full" style={{ minHeight: 16 }} />}
      </div>
      <div className={last ? "pb-0" : "pb-4"}>
        <p className="text-[13.5px] font-semibold leading-tight">{step.title}</p>
        <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{step.meta}</p>
      </div>
    </div>
  );
}

function fmt(ts: string | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The local "Drafted" step + the submission's own progression — deliberately
 * scoped to the TRACES lifecycle only (not batches/plots/POs, which are a
 * separate use case — see compliance-flow-reframe.md Phase 2). */
function buildTimeline(
  display: DisplayKey,
  submission: TracesSubmission | null,
  ddsCreatedAt?: string,
): TimelineStep[] {
  const steps: TimelineStep[] = [
    { title: "Drafted", meta: ddsCreatedAt ? fmt(ddsCreatedAt) : "Locally, not yet submitted", icon: FileText, state: "done" },
  ];

  if (!submission) {
    steps.push({ title: "Submitted to TRACES", meta: "Not yet submitted", icon: Send, state: "pending" });
    return steps;
  }

  const submittedState: TimelineStep["state"] = display === "submitting" ? "current" : "done";
  steps.push({
    title: "Submitted to TRACES",
    meta: submittedState === "current" ? "Sending…" : fmt(submission.created_at),
    icon: Send,
    state: submittedState,
  });

  if (display === "submitting") {
    steps.push({ title: "Result", meta: "Awaiting TRACES", icon: CheckCircle2, state: "pending" });
    return steps;
  }

  if (display === "submitted") {
    steps.push({ title: "Result", meta: "Awaiting TRACES review", icon: CheckCircle2, state: "current" });
    return steps;
  }

  if (display === "available") {
    steps.push({
      title: "Available",
      meta: submission.submitted_at ? `Verification number issued · ${fmt(submission.submitted_at)}` : "Verification number issued",
      icon: CheckCircle2,
      state: "done",
    });
    return steps;
  }

  if (display === "rejected" || display === "failed") {
    steps.push({ title: display === "rejected" ? "Rejected" : "Failed", meta: "See detail below", icon: XCircle, state: "error" });
    return steps;
  }

  if (display === "withdrawn") {
    steps.push({ title: "Withdrawn", meta: fmt(submission.last_attempted_at) || "Withdrawn from TRACES", icon: XCircle, state: "done" });
    return steps;
  }

  steps.push({ title: STATUS_META[display].label, meta: "", icon: CheckCircle2, state: "done" });
  return steps;
}

export function TracesPanel({
  ddsId,
  ddsStatus,
  activityType,
  ddsCreatedAt,
}: {
  ddsId: string;
  ddsStatus?: DDSStatus;
  activityType?: string;
  ddsCreatedAt?: string;
}) {
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

  const sub = submission ?? null;
  const display = deriveDisplay(sub);

  const submitMutation = useMutation({
    mutationFn: async () => {
      // ADR-0017's per-state endpoint split: FAILED (our pipeline gave up
      // before/without TRACES responding) re-queues the SAME row via the
      // retry endpoint, preserving one row's honest attempt_count/audit
      // history — a regulated submission's SOAP request/response trail.
      // Everything else (no prior submission, or a new filing after a
      // TRACES-side REJECTED — that row was already consumed by TRACES) is
      // a new CREATE.
      const retryTarget = display === "failed" && sub ? sub.id : null;
      const res = await authFetch(
        retryTarget
          ? `/api/v1/traces/submissions/${retryTarget}/retry/`
          : `/api/v1/traces/submissions/`,
        retryTarget
          ? { method: "POST" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dds_id: ddsId }),
            },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(getErrorMessage(body)) as Error & { fieldErrors?: TracesErrorDetail[] };
        if (Array.isArray(body.errors)) err.fieldErrors = body.errors;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmOpen(false);
      toast.success("Submitted to TRACES");
      queryClient.invalidateQueries({ queryKey: ["traces-submission", ddsId] });
      queryClient.invalidateQueries({ queryKey: ["dds", ddsId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const style = STATUS_META[display];
  const pending = isPending(sub);
  const canResubmit = !sub || display === "rejected" || display === "failed";
  // The "must be Approved" gate mirrors the backend's submit-time check
  // (#50) for a *fresh* submission only. Remediation after a TRACES
  // rejection/failure is keyed on the submission's own `traces_status` +
  // `error_detail` (ADR pending, principal-architect) — it must not also
  // require a DDS.status transition the backend doesn't perform today.
  const notApproved = !sub && ddsStatus !== undefined && ddsStatus !== "APPROVED";
  const submitDisabled = hasCreds === false || notApproved;
  const timeline = buildTimeline(display, sub, ddsCreatedAt);
  const submitFieldErrors = (submitMutation.error as (Error & { fieldErrors?: TracesErrorDetail[] }) | undefined)?.fieldErrors;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
          TRACES Submission
        </h2>
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
      </div>

      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : display === "available" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-6">
            <CopyChip label="Reference Number" value={sub!.traces_reference_number} />
            <CopyChip label="Verification Number" value={sub!.verification_number} />
          </div>
          <AmendWindow submittedAt={sub!.submitted_at} />
        </div>
      ) : display === "rejected" || display === "failed" ? (
        <div className="space-y-3">
          <ErrorDetail submission={sub!} display={display} />
          <p className="text-xs text-muted-foreground">
            Fix the issue on the underlying batches/plots, then resubmit.
          </p>
        </div>
      ) : pending ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          {display === "submitting" ? "Submitting to TRACES…" : "Submitted — waiting for TRACES to resolve…"}
        </p>
      ) : display === "withdrawn" || display === "grouped" || display === "archived" ? (
        <p className="text-sm text-muted-foreground">
          {display === "withdrawn"
            ? "This DDS was withdrawn from TRACES."
            : display === "grouped"
              ? "This DDS is grouped under another submission."
              : "This DDS is archived in TRACES."}
          {sub!.traces_reference_number && (
            <span className="ml-1 font-mono">({sub!.traces_reference_number})</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not submitted to TRACES.</p>
      )}

      {canResubmit && !pending && (
        <div className="mt-4">
          <Button
            size="sm"
            disabled={submitDisabled}
            onClick={() => setConfirmOpen(true)}
            className="gap-1.5"
          >
            <Send className="size-3.5" />
            {sub ? "Resubmit to TRACES" : "Submit to TRACES"}
          </Button>
          {hasCreds === false && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Configure TRACES credentials first (Settings → TRACES connection).
            </p>
          )}
          {hasCreds !== false && notApproved && (
            <p className="text-xs text-muted-foreground mt-1.5">
              This DDS must be Approved before it can be submitted to TRACES (current status: {ddsStatus}).
            </p>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-border/50">
        <h3 className="text-[10px] font-medium tracking-[0.14em] uppercase text-muted-foreground mb-3">
          TRACES Timeline
        </h3>
        <div>
          {timeline.map((step, i) => (
            <TimelineRow key={step.title} step={step} last={i === timeline.length - 1} />
          ))}
        </div>
      </div>

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
            <div className="space-y-1.5">
              <p className="text-sm text-destructive">{submitMutation.error.message}</p>
              {submitFieldErrors && submitFieldErrors.length > 0 && (
                <ul className="space-y-1 text-xs text-destructive">
                  {submitFieldErrors.map((e, i) => (
                    <li key={`${e.field}-${i}`}>
                      <span className="font-mono font-medium">{e.field}</span>: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
