"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  PenLine,
  RefreshCw,
  Send,
  Undo2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyChip } from "@/components/copy-chip";
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { useLatestTracesSubmission } from "@/hooks/use-latest-traces-submission";
import { deriveTracesDisplay, type TracesDisplayKey } from "@/lib/traces-status";
import type { DDSStatus, TracesErrorDetail, TracesSubmission } from "@/lib/api/types";

/**
 * Local, derived display state for the panel — collapses the internal
 * pipeline `status` (QUEUED/PROCESSING/SUBMITTED/FAILED/RETRYING) and the
 * TRACES-assigned `traces_status` (SUBMITTED/AVAILABLE/REJECTED/WITHDRAWN/
 * GROUPED/ARCHIVED) into one set of badge/copy states so the rest of the
 * component never has to reason about both fields at once.
 */
/** The panel adds one state the list has no use for: a statement with no
 * submission at all. Everything else is `TracesDisplayKey`, derived by the
 * shared `deriveTracesDisplay` so the two surfaces cannot disagree about the
 * same row again. */
type DisplayKey = TracesDisplayKey | "not_submitted";

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
  suspended: { label: "Suspended", bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]" },
  updated: { label: "Updated", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  obsolete: { label: "Obsolete", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

/** Body copy for every lifecycle state TRACES can report and the officer
 * cannot act on. Keyed exhaustively so a status added to the badge and the
 * timeline cannot quietly fall through to "Not submitted to TRACES." — which
 * is what happened when SUSPENDED, UPDATED and OBSOLETE were added: the badge
 * said "Suspended", the timeline showed a completed step, and the body said
 * the statement had never been submitted. */
const SETTLED_COPY: Partial<Record<DisplayKey, string>> = {
  withdrawn: "This DDS was withdrawn from TRACES.",
  grouped: "This DDS is grouped under another submission.",
  archived: "This DDS is archived in TRACES.",
  suspended: "TRACES has suspended this DDS.",
  updated: "This DDS was superseded by an updated version in TRACES.",
  obsolete: "TRACES marks this DDS obsolete.",
};

/** "a domestic activity" but "an import activity".
 *
 * The activity is never invented here. This dialog is the last thing an officer
 * reads before a regulated filing, and it previously rendered
 * `activityType || "DOMESTIC"` — describing a statement that declares no
 * activity as a *domestic* one, which is a claim about EU production that the
 * statement does not make. Same defect eudr-app#191 removed from the envelope.
 * When there is no activity type the phrase is omitted entirely; the backend
 * refuses the submission anyway, with a field-level error. */
function indefiniteArticle(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** ADR-0017's derivation table, shared with the Submissions list badge
 * (`@/lib/traces-status`) — the two used to hold separate copies and drifted,
 * so the same statement read "Submitted" on the list and "Failed" here. */
function deriveDisplay(sub: TracesSubmission | null): DisplayKey {
  return deriveTracesDisplay(sub) ?? "not_submitted";
}

function isPending(sub: TracesSubmission | null): boolean {
  return !!STATUS_META[deriveDisplay(sub)].pending;
}

/** `GET /api/v1/traces/credentials/` is `IsAdmin`-gated server-side (only an
 * org admin can view/manage TRACES credentials) — for any other role this
 * 403s, which is indistinguishable from "no credentials configured" and
 * would permanently disable Submit for exactly the persona whose job is
 * submitting (#36/#70). Only ever call this behind an `isAdmin` check; for
 * everyone else, skip the pre-check entirely and let the DDS-status gate
 * govern Submit — a genuine missing-credentials failure still surfaces via
 * the backend's structured submit error (FAILED + error_detail). */
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

/** What to actually do about a failure.
 *
 * The panel used to say "Fix the issue on the underlying batches/plots, then
 * resubmit" for every failure. On the live 2026-09-03 rejection that advice
 * was simply wrong: the two rules TRACES broke were
 * `EUDR-OPERATOR-EORI-FOR-ACTIVITY-MISSING` and a `percentageEstimation` rule,
 * neither of which concerns a batch or a plot. Someone following it would
 * have gone through their lots looking for a problem that was not there
 * (eudr-app#202).
 *
 * Classified from the structured rule ids TRACES returns, which are the only
 * reliable part of a rejection — its `<Message>` values are untranslated i18n
 * keys and `<Field>` is usually empty.
 */
function RemediationHint({ submission }: { submission: TracesSubmission }) {
  const haystack = [
    submission.error_message,
    ...(submission.error_detail ?? []).flatMap((d) => [d.field, d.message]),
  ]
    .join(" ")
    .toUpperCase();

  const isAboutTheAccount =
    haystack.includes("OPERATOR") ||
    haystack.includes("EORI") ||
    haystack.includes("WEBSERVICE-USER") ||
    haystack.includes("CREDENTIAL") ||
    haystack.includes("UNAUTHENTICATED");
  const isAboutTheGoods =
    haystack.includes("BATCH[") ||
    haystack.includes("PLOT") ||
    haystack.includes("HARVEST") ||
    haystack.includes("COMMODIT") ||
    haystack.includes("GEOLOCATION");

  if (isAboutTheAccount && !isAboutTheGoods) {
    return (
      <p className="text-xs text-muted-foreground">
        This is about how your organisation is registered with TRACES, not about
        your lots or plots. Check the Web Service Identifier, EUDR role and
        Authentication Key in{" "}
        <Link href="/settings" className="text-primary hover:underline">
          Settings → TRACES
        </Link>
        , then resubmit.
      </p>
    );
  }
  if (isAboutTheGoods) {
    return (
      <p className="text-xs text-muted-foreground">
        Fix the issue on the underlying lots or plots, then resubmit.
      </p>
    );
  }
  if (haystack.trim() === "") {
    // `ErrorDetail` renders "The submission failed before TRACES could process
    // it." for this row. Telling the officer to resolve the problem TRACES
    // named, when TRACES named nothing and may never have seen the statement,
    // sends them looking for a message that does not exist.
    return (
      <p className="text-xs text-muted-foreground">
        No detail was recorded for this failure. Retry it, and if it fails again
        check the TRACES connection in{" "}
        <Link href="/settings" className="text-primary hover:underline">
          Settings
        </Link>
        .
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Resolve the problem TRACES names above, then resubmit. If it names a rule
      rather than a field, it concerns the statement as a whole rather than one
      lot.
    </p>
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
  const [modifyOpen, setModifyOpen] = useState<"amend" | "withdraw" | null>(null);

  const { data: submission, isLoading, isError } = useLatestTracesSubmission(ddsId);

  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";

  // Admin-only pre-check (see fetchHasCredentials doc comment above) — a UX
  // nicety for the person who can actually add credentials. Disabled for
  // every other role so a 403 here never masks the real DDS-status gate.
  const { data: hasCreds } = useQuery({
    queryKey: ["traces-credentials"],
    queryFn: fetchHasCredentials,
    enabled: isAdmin,
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
      // For a CREATE row that already reached TRACES the backend re-polls
      // rather than re-files, which is why "Check status at TRACES" routes
      // here too.
      // The backend re-runs the row's OWN operation, so a retry here is never
      // a disguised CREATE. The button that offers it is gated separately
      // (`canResubmit`) — a failed amendment is retried through the amend
      // action, not through "Submit to TRACES".
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

  /** Amend and withdraw both address one existing filing by its TRACES uuid,
   * and both are refused by the backend unless that filing is AVAILABLE. */
  // `pk` names the statement; the backend resolves which filing to act on
  // (`authoritative_filing`). That matters here: after a failed amendment the
  // latest row is that FAILED UPDATE, and the client cannot identify the live
  // AVAILABLE filing itself — the submissions list serializer carries no
  // `traces_status`, so it would take a detail fetch per row.
  const modifyMutation = useMutation({
    mutationFn: async (action: "amend" | "withdraw") => {
      const res = await authFetch(
        `/api/v1/traces/submissions/${sub!.id}/${action}/`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
      return res.json();
    },
    onSuccess: (_data, action) => {
      setModifyOpen(null);
      toast.success(
        action === "amend" ? "Amendment sent to TRACES" : "Withdrawal sent to TRACES",
      );
      queryClient.invalidateQueries({ queryKey: ["traces-submission", ddsId] });
      queryClient.invalidateQueries({ queryKey: ["dds", ddsId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  /** Open the confirm dialog for one action, clearing whatever the previous
   * one left behind. Cancel is a plain button rather than a `DialogClose`, so
   * it never fires `onOpenChange` — without this, an amendment's error greeted
   * whoever opened the withdraw dialog next, describing an action they had not
   * taken. Every entry point goes through here for that reason. */
  function openModify(action: "amend" | "withdraw") {
    modifyMutation.reset();
    setModifyOpen(action);
  }

  const style = STATUS_META[display];
  const pending = isPending(sub);
  // `traces_uuid` is the question, not `submission_type`. A row carrying one
  // describes a filing TRACES already has — whether it is a failed amendment,
  // or a CREATE that filed successfully and then failed on a *poll*
  // (`poll._fail_business_rejection` leaves the uuid in place, because the
  // filing itself is fine). Offering "Resubmit to TRACES" in either case
  // points at the one action that must not happen: a second regulated
  // declaration under a new reference number. Keying on the row's type missed
  // the second case entirely.
  const reachedTraces = !!sub?.traces_uuid;
  const canResubmit =
    !sub || ((display === "rejected" || display === "failed") && !reachedTraces);
  // A failed call leaves the filing itself untouched at TRACES. The panel
  // showed "Failed" with no reference number and no way to act on the
  // statement that still exists, so it could not even be retried.
  const filingSurvives = display === "failed" && reachedTraces;
  // The "must be Approved" gate mirrors the backend's submit-time check
  // (#50) for a *fresh* submission only. Remediation after a TRACES
  // rejection/failure is keyed on the submission's own `traces_status` +
  // `error_detail` (ADR pending, principal-architect) — it must not also
  // require a DDS.status transition the backend doesn't perform today.
  const notApproved = !sub && ddsStatus !== undefined && ddsStatus !== "APPROVED";
  // Only blocks Submit for the admin pre-check (see hasCreds's `enabled` gate
  // above) — for every other role this is always false, so `notApproved`
  // alone governs Submit, same as it does server-side.
  const credentialsBlocking = isAdmin && hasCreds === false;
  const submitDisabled = credentialsBlocking || notApproved;
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
      ) : isError ? (
        // Never "Not submitted to TRACES." on a failed lookup. That is a flat
        // claim about a regulated filing, and it would be made most often for
        // exactly the statements that are filed. The page header hides its own
        // withdraw control in the same case; this is the other half.
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          Could not load this statement&rsquo;s TRACES status. It may still be
          filed — reload before acting on it.
        </p>
      ) : display === "available" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-6">
            <CopyChip label="Reference Number" value={sub!.traces_reference_number} />
            <CopyChip label="Verification Number" value={sub!.verification_number} />
          </div>
          <AmendWindow submittedAt={sub!.submitted_at} />
          {/* A filing was one-way until now. Both actions are live calls to
              the regulator, so both go through a confirm step. */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => openModify("amend")}
            >
              <PenLine className="size-3.5" />
              Amend
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => openModify("withdraw")}
            >
              <Undo2 className="size-3.5" />
              Withdraw
            </Button>
          </div>
        </div>
      ) : display === "rejected" || display === "failed" ? (
        <div className="space-y-3">
          <ErrorDetail submission={sub!} display={display} />
          <RemediationHint submission={sub!} />
          {filingSurvives && (
            <div className="space-y-3 rounded-xl border border-border/40 bg-secondary/25 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {sub!.submission_type === "CREATE"
                  ? "The statement is filed with TRACES — what failed was checking its status."
                  : `The ${
                      sub!.submission_type === "WITHDRAW" ? "withdrawal" : "amendment"
                    } failed. The statement is still filed with TRACES.`}
              </p>
              <div className="flex flex-wrap gap-6">
                <CopyChip label="Reference Number" value={sub!.traces_reference_number} />
                <CopyChip label="Verification Number" value={sub!.verification_number} />
              </div>
              <div className="flex flex-wrap gap-2">
                {sub!.submission_type === "CREATE" && (
                  // Retry re-polls a CREATE row that already reached TRACES,
                  // rather than re-filing it. Labelled for what it does: an
                  // officer told to "resubmit" a statement TRACES already
                  // holds would reasonably expect a second filing.
                  <Button
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    disabled={submitMutation.isPending}
                    onClick={() => submitMutation.mutate()}
                  >
                    <RefreshCw className="size-3.5" />
                    Check status at TRACES
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => openModify("amend")}
                >
                  <PenLine className="size-3.5" />
                  Amend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => openModify("withdraw")}
                >
                  <Undo2 className="size-3.5" />
                  Withdraw
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : pending ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          {display === "submitting" ? "Submitting to TRACES…" : "Submitted — waiting for TRACES to resolve…"}
        </p>
      ) : SETTLED_COPY[display] ? (
        <p className="text-sm text-muted-foreground">
          {SETTLED_COPY[display]}
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
          {credentialsBlocking && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Configure TRACES credentials first (Settings → TRACES connection).
            </p>
          )}
          {!credentialsBlocking && notApproved && (
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

      <Dialog
        open={modifyOpen !== null}
        onOpenChange={(open) => {
          if (!open) setModifyOpen(null);
          // Otherwise a failed amendment's error greets whoever opens the
          // withdraw dialog next, describing the wrong action entirely.
          modifyMutation.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modifyOpen === "withdraw"
                ? "Withdraw this statement from TRACES?"
                : "Amend this statement at TRACES?"}
            </DialogTitle>
            <DialogDescription>
              {modifyOpen === "withdraw" ? (
                <>
                  This retracts the filing{" "}
                  <span className="font-mono">{sub?.traces_reference_number}</span>{" "}
                  at the regulator. The statement is only marked withdrawn here
                  once TRACES confirms it. This is a regulated action.
                </>
              ) : (
                <>
                  This re-files the statement as it stands now — including any
                  corrections since made to its lots or plots — keeping the same
                  reference number{" "}
                  <span className="font-mono">{sub?.traces_reference_number}</span>
                  . TRACES re-runs risk profiling. This is a regulated action.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {/* Deliberately not a client-side window check. TRACES measures the
              72 hours from when the reference number became visible — an
              event we do not record — so refusing here would block
              amendments that are still legal. TRACES decides, and says why. */}
          <p className="text-xs text-muted-foreground">
            TRACES refuses this once the 72-hour window has closed, or once the
            statement is locked to a customs declaration. If it does, the reason
            it gives will appear here.
          </p>
          {modifyMutation.isError && (
            <p className="text-sm text-destructive">{modifyMutation.error.message}</p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setModifyOpen(null);
                modifyMutation.reset();
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={modifyOpen === "withdraw" ? "destructive" : "default"}
              disabled={modifyMutation.isPending}
              onClick={() => modifyOpen && modifyMutation.mutate(modifyOpen)}
              className="gap-1.5"
            >
              {modifyMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : modifyOpen === "withdraw" ? (
                <Undo2 className="size-3.5" />
              ) : (
                <PenLine className="size-3.5" />
              )}
              {modifyOpen === "withdraw" ? "Withdraw" : "Amend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit this DDS to TRACES?</DialogTitle>
            <DialogDescription>
              This files the Due Diligence Statement to the EU TRACES{" "}
              <span className="font-medium">Acceptance</span> environment
              {activityType ? (
                <>
                  {" "}
                  as {indefiniteArticle(activityType)}{" "}
                  <span className="font-medium">{activityType.toLowerCase()}</span>{" "}
                  activity
                </>
              ) : null}
              . This is a regulated action.
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
