import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";
import { TracesPanel } from "@/components/traces/traces-panel";
import type { TracesSubmission } from "@/lib/api/types";

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));
import { authFetch } from "@/lib/api/client";
const mockAuthFetch = vi.mocked(authFetch);

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";

function jsonRes(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function baseSubmission(overrides: Partial<TracesSubmission>): TracesSubmission {
  return {
    id: "sub-1",
    dds_id: "dds-1",
    submission_type: "CREATE",
    status: "SUBMITTED",
    traces_status: "SUBMITTED",
    // Blank by default: a submission that failed before reaching TRACES has no
    // uuid, and that is what separates a retryable transport failure from a
    // filing that already exists. Tests that mean "this reached TRACES" set it.
    traces_uuid: "",
    verification_number: "",
    traces_reference_number: "",
    error_message: "",
    error_detail: [],
    attempt_count: 1,
    last_attempted_at: null,
    next_retry_at: null,
    submitted_at: null,
    submitted_by_id: "u1",
    soap_request_payload: "",
    soap_response_payload: "",
    created_at: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

/**
 * The real `TracesSubmissionListView` GET returns the lightweight
 * `TracesSubmissionListSerializer` (no `traces_status`/`verification_number`/
 * `error_message`/`error_detail`) — the panel must follow up with a detail
 * GET by id to get the full row. Mock both legs.
 *
 * `role` defaults to "ADMIN" — the credentials pre-check (#36/#70) only ever
 * runs for an admin, so tests that exercise `hasCreds` gating need an admin
 * `/auth/users/me/` response to reach it at all; tests that don't care about
 * credentials gating are unaffected by the default.
 */
function mockApi({
  submission = null,
  hasCreds = true,
  role = "ADMIN",
}: {
  submission?: TracesSubmission | null;
  hasCreds?: boolean;
  role?: "ADMIN" | "COMPLIANCE_OFFICER" | "VIEWER" | "SUPPLIER_CONTACT";
}) {
  mockAuthFetch.mockImplementation((url: string) => {
    if (url.includes("/auth/users/me/")) {
      return Promise.resolve(jsonRes({ id: "u1", role, organization_id: "org-1" }));
    }
    if (url.includes("/traces/credentials/")) {
      return Promise.resolve(jsonRes({ results: hasCreds ? [{ id: "c1" }] : [] }));
    }
    if (url.includes("/traces/submissions/?dds_id")) {
      return Promise.resolve(
        jsonRes({ results: submission ? [{ id: submission.id, dds_id: submission.dds_id }] : [] }),
      );
    }
    if (submission && url === `/api/v1/traces/submissions/${submission.id}/`) {
      return Promise.resolve(jsonRes(submission));
    }
    return Promise.resolve(jsonRes({}));
  });
}

describe("TracesPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an enabled Submit action when no submission exists, credentials are present, and the DDS is Approved", async () => {
    mockApi({ submission: null, hasCreds: true });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" activityType="IMPORT" />);
    await waitFor(() => expect(screen.getByText("Not submitted to TRACES.")).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: /submit to traces/i });
    expect(btn).toBeEnabled();
  });

  it("disables Submit with a hint when no credentials are configured (ADMIN pre-check, #36/#70)", async () => {
    mockApi({ submission: null, hasCreds: false, role: "ADMIN" });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);
    await waitFor(() =>
      expect(screen.getByText(/configure traces credentials first/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /submit to traces/i })).toBeDisabled();
    // The pre-check only runs for an admin — confirms this test actually
    // exercised the gated query, not a coincidental default.
    expect(
      mockAuthFetch.mock.calls.some(([u]) => (u as string).includes("/traces/credentials/")),
    ).toBe(true);
  });

  it("a COMPLIANCE_OFFICER sees an enabled Submit on an APPROVED DDS even with no TRACES credentials configured — the admin-only pre-check must not gate non-admin roles (#36)", async () => {
    mockApi({ submission: null, hasCreds: false, role: "COMPLIANCE_OFFICER" });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);
    await waitFor(() => expect(screen.getByText("Not submitted to TRACES.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /submit to traces/i })).toBeEnabled();
    // The credentials endpoint must never be called for a non-admin — it's
    // IsAdmin-gated server-side and would otherwise 403, which is exactly
    // the bug this test locks in the fix for.
    expect(
      mockAuthFetch.mock.calls.some(([u]) => (u as string).includes("/traces/credentials/")),
    ).toBe(false);
    expect(screen.queryByText(/configure traces credentials first/i)).not.toBeInTheDocument();
  });

  it("a VIEWER's Submit stays governed by the DDS-status gate alone (no credentials pre-check)", async () => {
    mockApi({ submission: null, hasCreds: false, role: "VIEWER" });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="DRAFT" />);
    await waitFor(() => expect(screen.getByText(/must be approved/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /submit to traces/i })).toBeDisabled();
    expect(
      mockAuthFetch.mock.calls.some(([u]) => (u as string).includes("/traces/credentials/")),
    ).toBe(false);
  });

  it("disables Submit with a hint when the DDS is not Approved (mirrors the backend's submit gate)", async () => {
    mockApi({ submission: null, hasCreds: true });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="DRAFT" />);
    await waitFor(() => expect(screen.getByText(/must be approved/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /submit to traces/i })).toBeDisabled();
  });

  it("renders reference + verification chips when the submission is AVAILABLE", async () => {
    mockApi({
      submission: baseSubmission({
        traces_status: "AVAILABLE",
        status: "SUBMITTED",
        traces_reference_number: "REF-123",
        verification_number: "VER-456",
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);
    await waitFor(() => expect(screen.getByText("REF-123")).toBeInTheDocument());
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.getByText("Reference Number")).toBeInTheDocument();
    expect(screen.getByText("Verification Number")).toBeInTheDocument();
    expect(screen.getByText("VER-456")).toBeInTheDocument();
  });

  it("shows the classified error when TRACES-rejected, and allows resubmit keyed on traces_status/error_detail (not DDS status)", async () => {
    // A traces_status=REJECTED row is a *business* rejection observed on an
    // already-submitted DDS — the DDS itself stays SUBMITTED (not APPROVED)
    // on the backend today. Remediation readiness is keyed on the
    // submission's own traces_status/error_detail (principal-architect
    // ruling pending an ADR), not on a DDS.status transition the backend
    // doesn't perform — the "must be Approved" gate only applies to a
    // *fresh* (no prior submission) Submit.
    mockApi({
      submission: baseSubmission({
        traces_status: "REJECTED",
        status: "SUBMITTED",
        error_message: "Geolocation polygon invalid for plot P1",
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);
    await waitFor(() =>
      expect(screen.getByText(/geolocation polygon invalid/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /resubmit to traces/i })).toBeEnabled();
  });

  it("renders structured per-field error_detail (not a flattened string) for a FAILED payload-validation submission, and allows resubmit", async () => {
    mockApi({
      submission: baseSubmission({
        status: "FAILED",
        traces_status: "" as TracesSubmission["traces_status"],
        error_message: "Payload validation failed: 1 error.",
        error_detail: [
          { field: "batch[0].harvest_period", message: "harvest_period_start is required" },
        ],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);
    await waitFor(() => expect(screen.getByText("batch[0].harvest_period")).toBeInTheDocument());
    expect(screen.getByText(/harvest_period_start is required/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resubmit to traces/i })).toBeEnabled();
  });

  it("a FAILED submission with no error_message/error_detail (e.g. exhausted transport retries) does not claim TRACES rejected it", async () => {
    // Discovered against the real backend: a submission can go FAILED before
    // TRACES ever saw it (transport/credential faults), landing with an
    // empty error_message. The copy must not say "TRACES rejected" for a
    // claim TRACES never made.
    mockApi({
      submission: baseSubmission({
        status: "FAILED",
        traces_status: "" as TracesSubmission["traces_status"],
        error_message: "",
        error_detail: [],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);
    await waitFor(() =>
      expect(screen.getByText(/failed before traces could process it/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/traces rejected/i)).not.toBeInTheDocument();
  });

  it("a RETRYING submission renders 'Submitting…' (not 'Not submitted') and stays pending, not 'Resubmit' (ADR-0017)", async () => {
    // RETRYING is a real TracesSubmission.Status member (backend dedup treats
    // it as in-flight, per test_views.py) that IN_FLIGHT previously omitted —
    // it fell through every deriveDisplay branch to "not_submitted", showing
    // an active Submit button on a submission that's actively in flight, and
    // silently stopping refetchInterval polling (isPending gates on the same
    // derivation).
    mockApi({
      submission: baseSubmission({
        status: "RETRYING",
        traces_status: "" as TracesSubmission["traces_status"],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);
    await waitFor(() => expect(screen.getByText(/submitting to traces/i)).toBeInTheDocument());
    expect(screen.queryByText("Not submitted to TRACES.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit to traces/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resubmit to traces/i })).not.toBeInTheDocument();
  });

  it("retries a FAILED submission via POST .../submissions/<id>/retry/ (re-queues the same row), not a new CREATE (ADR-0017)", async () => {
    let retryCalled = false;
    let createCalled = false;
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/traces/credentials/")) {
        return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ results: [{ id: "sub-failed-1" }] }));
      }
      if (url === "/api/v1/traces/submissions/sub-failed-1/retry/" && init?.method === "POST") {
        retryCalled = true;
        return Promise.resolve(
          jsonRes(
            baseSubmission({
              id: "sub-failed-1",
              status: "QUEUED",
              traces_status: "" as TracesSubmission["traces_status"],
            }),
          ),
        );
      }
      if (url === "/api/v1/traces/submissions/" && init?.method === "POST") {
        createCalled = true;
        return Promise.resolve(jsonRes({ id: "sub-new", status: "QUEUED" }, 201));
      }
      if (url === "/api/v1/traces/submissions/sub-failed-1/") {
        return Promise.resolve(
          jsonRes(
            baseSubmission({
              id: "sub-failed-1",
              status: "FAILED",
              traces_status: "" as TracesSubmission["traces_status"],
              error_message: "Payload validation failed: 1 error.",
              error_detail: [{ field: "batch[0].harvest_period", message: "harvest_period_start is required" }],
            }),
          ),
        );
      }
      return Promise.resolve(jsonRes({}));
    });

    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /resubmit to traces/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /resubmit to traces/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /submit to traces/i }));
    await waitFor(() => expect(retryCalled).toBe(true));
    expect(createCalled).toBe(false);
  });

  it("still files a new CREATE (not retry) when resubmitting after a TRACES REJECTED — per ADR-0017's per-state split", async () => {
    // The retry endpoint re-queues a specific TracesSubmission row; a
    // REJECTED row was already processed by TRACES (traces_uuid consumed),
    // so remediation after a business rejection is a new filing, not a
    // re-queue of the old row. Locks in that this fix doesn't also reroute
    // the REJECTED path (that stays a new CREATE per the ADR and the
    // now-existing test above for FAILED).
    let createCalled = false;
    let retryCalled = false;
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/traces/credentials/")) {
        return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ results: [{ id: "sub-rejected-1" }] }));
      }
      if (url === "/api/v1/traces/submissions/sub-rejected-1/retry/") {
        retryCalled = true;
        return Promise.resolve(jsonRes({}));
      }
      if (url === "/api/v1/traces/submissions/" && init?.method === "POST") {
        createCalled = true;
        return Promise.resolve(jsonRes({ id: "sub-new", status: "QUEUED" }, 201));
      }
      if (url === "/api/v1/traces/submissions/sub-rejected-1/") {
        return Promise.resolve(
          jsonRes(
            baseSubmission({
              id: "sub-rejected-1",
              status: "SUBMITTED",
              traces_status: "REJECTED",
              error_message: "Geolocation polygon invalid for plot P1",
            }),
          ),
        );
      }
      return Promise.resolve(jsonRes({}));
    });

    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /resubmit to traces/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /resubmit to traces/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /submit to traces/i }));
    await waitFor(() => expect(createCalled).toBe(true));
    expect(retryCalled).toBe(false);
  });

  it("shows the 72h amendment window on an AVAILABLE submission", async () => {
    mockApi({
      submission: baseSubmission({
        traces_status: "AVAILABLE",
        traces_reference_number: "REF-1",
        verification_number: "VER-1",
        submitted_at: new Date().toISOString(),
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);
    await waitFor(() => expect(screen.getByText(/amendment window/i)).toBeInTheDocument());
    expect(screen.getByText(/left to amend/i)).toBeInTheDocument();
  });

  it("shows a TRACES timeline that advances from Drafted through the submission's outcome", async () => {
    mockApi({
      submission: baseSubmission({ traces_status: "AVAILABLE", traces_reference_number: "REF-1" }),
    });
    renderWithProviders(
      <TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" ddsCreatedAt="2026-06-29T00:00:00Z" />,
    );
    await waitFor(() => expect(screen.getByText("REF-1")).toBeInTheDocument());
    expect(screen.getByText("Drafted")).toBeInTheDocument();
    expect(screen.getByText("Submitted to TRACES")).toBeInTheDocument();
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
  });

  it("submits via the confirm dialog and then shows the resulting submission", async () => {
    let submitted = false;
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/traces/credentials/")) {
        return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ results: submitted ? [{ id: "sub-9" }] : [] }));
      }
      if (url === "/api/v1/traces/submissions/sub-9/") {
        return Promise.resolve(
          jsonRes(
            baseSubmission({
              id: "sub-9",
              traces_status: "AVAILABLE",
              traces_reference_number: "REF-9",
              verification_number: "VER-9",
            }),
          ),
        );
      }
      if (url === "/api/v1/traces/submissions/" && init?.method === "POST") {
        submitted = true;
        return Promise.resolve(jsonRes({ id: "sub-9", status: "QUEUED" }, 201));
      }
      return Promise.resolve(jsonRes({}));
    });

    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" activityType="IMPORT" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /submit to traces/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /submit to traces/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /submit to traces/i }));
    await waitFor(() => expect(screen.getByText("REF-9")).toBeInTheDocument());
    expect(
      mockAuthFetch.mock.calls.some(
        ([u, i]) => u === "/api/v1/traces/submissions/" && (i as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it("surfaces the backend's 409 dedup conflict as an error toast and keeps the dialog open for retry", async () => {
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/traces/credentials/")) {
        return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ results: [] }));
      }
      if (url === "/api/v1/traces/submissions/" && init?.method === "POST") {
        return Promise.resolve(
          jsonRes({ detail: "A TRACES submission is already in flight for this DDS." }, 409),
        );
      }
      return Promise.resolve(jsonRes({}));
    });

    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" activityType="IMPORT" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /submit to traces/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /submit to traces/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /submit to traces/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("A TRACES submission is already in flight for this DDS."),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ── the confirmation must describe the actual filing ─────────────────────────
//
// This dialog is the last thing an officer reads before a regulated filing, so
// it has to describe the statement that is about to be sent. It rendered
// `(activityType || "DOMESTIC")` — the same invented-claim defect eudr-app#191
// removed from the envelope, surviving in the UI: a statement with no activity
// type was described as a *domestic* filing, immediately above the words "This
// is a regulated action".

describe("TracesPanel — submit confirmation copy", () => {
  async function openConfirm(activityType?: string) {
    mockAuthFetch.mockImplementation(() => Promise.resolve(jsonRes({ results: [] })));
    const user = userEvent.setup();
    renderWithProviders(
      <TracesPanel ddsId="dds-1" ddsStatus="APPROVED" activityType={activityType} />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /submit to traces/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /submit to traces/i }));
    return screen.findByRole("dialog");
  }

  it("never claims DOMESTIC for a statement that declares no activity", async () => {
    const dialog = await openConfirm(undefined);
    expect(within(dialog).queryByText(/domestic/i)).toBeNull();
  });

  it("names the activity when the statement has one", async () => {
    const dialog = await openConfirm("IMPORT");
    expect(within(dialog).getByText(/import/i)).toBeInTheDocument();
  });

  it("uses the right article for a vowel-initial activity", async () => {
    const dialog = await openConfirm("IMPORT");
    expect(dialog.textContent).toContain("as an import activity");
    expect(dialog.textContent).not.toContain("as a import");
  });

  it("uses the right article for a consonant-initial activity", async () => {
    const dialog = await openConfirm("DOMESTIC");
    expect(dialog.textContent).toContain("as a domestic activity");
  });

  it("still warns that filing is regulated when no activity is set", async () => {
    const dialog = await openConfirm(undefined);
    expect(dialog.textContent).toMatch(/regulated action/i);
  });
});

describe("TracesPanel — amending and withdrawing a filed statement", () => {
  beforeEach(() => vi.clearAllMocks());

  const availableSubmission = () =>
    baseSubmission({
      traces_status: "AVAILABLE",
      traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
      traces_reference_number: "26FREQVKTA7K2V",
      verification_number: "VER-1",
      submitted_at: "2026-06-30T00:00:00Z",
    });

  it("offers both actions once TRACES holds the statement", async () => {
    mockApi({ submission: availableSubmission() });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^amend$/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument();
  });

  it("offers neither while the statement is still awaiting TRACES", async () => {
    // Both are refused server-side outside AVAILABLE; offering them anyway
    // would trade a clear "not yet" for a rule id the officer cannot action.
    mockApi({ submission: baseSubmission({ traces_status: "SUBMITTED" }) });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/waiting for traces to resolve/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^amend$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^withdraw$/i })).not.toBeInTheDocument();
  });

  it.each([
    ["withdraw", /withdraw this statement from traces/i],
    ["amend", /amend this statement at traces/i],
  ])("confirms before calling TRACES, then posts to the %s endpoint", async (action, heading) => {
    const submission = availableSubmission();
    mockApi({ submission });
    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: new RegExp(`^${action}$`, "i") })).toBeInTheDocument(),
    );
    // Nothing is sent by opening the dialog — this is a regulated write.
    await user.click(screen.getByRole("button", { name: new RegExp(`^${action}$`, "i") }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(heading)).toBeInTheDocument();
    expect(
      mockAuthFetch.mock.calls.some(([u]) => (u as string).includes(`/${action}/`)),
    ).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: new RegExp(`^${action}$`, "i") }));

    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        `/api/v1/traces/submissions/sub-1/${action}/`,
        { method: "POST" },
      ),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("surfaces the regulator's refusal instead of reporting success", async () => {
    // The 72-hour window is TRACES's to judge, so a refusal is an expected
    // outcome of pressing the button — not an error state to swallow.
    const submission = availableSubmission();
    mockApi({ submission });
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/withdraw/")) {
        return Promise.resolve(
          jsonRes({ detail: "Only an AVAILABLE filing can be withdrawn by TRACES" }, 400),
        );
      }
      if (url.includes("/auth/users/me/")) {
        return Promise.resolve(jsonRes({ id: "u1", role: "ADMIN", organization_id: "org-1" }));
      }
      if (url.includes("/traces/credentials/")) return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ results: [{ id: submission.id }] }));
      }
      if (url === `/api/v1/traces/submissions/${submission.id}/`) {
        return Promise.resolve(jsonRes(submission));
      }
      return Promise.resolve(jsonRes({}));
    });
    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^withdraw$/i }));

    await waitFor(() =>
      expect(
        within(dialog).getByText(/only an available filing can be withdrawn/i),
      ).toBeInTheDocument(),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("TracesPanel — what the officer is told to do about a failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not blame the lots for a fault about the operator's TRACES registration", async () => {
    // The live 2026-09-03 rejection. The panel said "Fix the issue on the
    // underlying batches/plots", and neither broken rule concerned a batch or
    // a plot — so the advice sent someone hunting through their lots for a
    // problem that was not there (eudr-app#202).
    mockApi({
      submission: baseSubmission({
        status: "FAILED",
        traces_status: "",
        error_message: "Some business rules are not met",
        error_detail: [
          {
            field: "EUDR-OPERATOR-EORI-FOR-ACTIVITY-MISSING",
            message: "eudr.validation.error.operator.eori.for.activity.missing",
          },
        ],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/registered with traces/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/fix the issue on the underlying/i)).not.toBeInTheDocument();
    // #158 moved the TRACES connection off /settings, which had been mixing a
    // personal profile with organisation config. The link must name where the
    // setting actually lives now, not just point there.
    expect(
      screen.getByRole("link", { name: /administration → traces/i }),
    ).toHaveAttribute("href", "/administration/traces");
  });

  it("still points at the lots when the fault really is about the goods", async () => {
    mockApi({
      submission: baseSubmission({
        status: "FAILED",
        traces_status: "",
        error_message: "Payload validation failed",
        error_detail: [
          {
            field: "batch[BCH-2026-012].harvest_period",
            message: "Lot is missing a harvest period.",
          },
        ],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/fix the issue on the underlying lots or plots/i)).toBeInTheDocument(),
    );
  });

  it("shows a failed poll instead of claiming the statement is still in flight", async () => {
    // `poll.py._fail_business_rejection` sets `status=FAILED` and leaves
    // `traces_status` at SUBMITTED, and the row stops being swept. Reading
    // `traces_status` first made the panel say "waiting for TRACES to
    // resolve…" forever for a submission nothing was still polling.
    mockApi({
      submission: baseSubmission({
        status: "FAILED",
        traces_status: "SUBMITTED",
        error_message: "Unknown uuid",
        error_detail: [{ field: "getDds", message: "Unknown uuid" }],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() => expect(screen.getByText("Unknown uuid")).toBeInTheDocument());
    expect(screen.queryByText(/waiting for traces to resolve/i)).not.toBeInTheDocument();
  });

  it.each([
    ["OBSOLETE", "Obsolete", /marks this dds obsolete/i],
    ["SUSPENDED", "Suspended", /has suspended this dds/i],
    ["UPDATED", "Updated", /superseded by an updated version/i],
  ])(
    "names %s in the badge AND says what it means in the body",
    async (tracesStatus, badge, body) => {
      // These were added to the badge and timeline maps but not to the body's
      // render chain, so they fell through to "Not submitted to TRACES." — a
      // card showing a "Suspended" badge, a completed timeline step, and copy
      // saying the statement had never been submitted. Asserting only that the
      // label appears somewhere (as the first version of this test did) passes
      // straight through that contradiction.
      mockApi({
        submission: baseSubmission({
          traces_status: tracesStatus as never,
          traces_reference_number: "26FREQVKTA7K2V",
        }),
      });
      renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

      await waitFor(() => expect(screen.getByText(body)).toBeInTheDocument());
      expect(screen.getAllByText(badge).length).toBeGreaterThan(0);
      expect(screen.queryByText(/not submitted to traces/i)).not.toBeInTheDocument();
    },
  );
});

describe("TracesPanel — a failed amendment or withdrawal", () => {
  beforeEach(() => vi.clearAllMocks());

  const failedModification = (type: "UPDATE" | "WITHDRAW") =>
    baseSubmission({
      submission_type: type,
      status: "FAILED",
      traces_status: "",
      traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
      traces_reference_number: "26FREQVKTA7K2V",
      verification_number: "VER-1",
      error_message: "Some business rules are not met",
      error_detail: [
        { field: "EUDR-DDS-AMENDMENT-PERIOD-EXPIRED", message: "window closed" },
      ],
    });

  it.each(["UPDATE", "WITHDRAW"] as const)(
    "never offers Resubmit for a failed %s row",
    async (type) => {
      // The backend re-runs the row's own operation, but before it was
      // hardened this button POSTed to `/retry/` on an UPDATE/WITHDRAW row and
      // the view dispatched `submit_dds_to_traces` — filing a second,
      // duplicate declaration for a statement TRACES already held AVAILABLE.
      mockApi({ submission: failedModification(type) });
      renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

      await waitFor(() =>
        expect(screen.getByText("EUDR-DDS-AMENDMENT-PERIOD-EXPIRED")).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("button", { name: /resubmit to traces/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^submit to traces$/i }),
      ).not.toBeInTheDocument();
    },
  );

  it("still offers Resubmit for a failed CREATE, which is what it is for", async () => {
    mockApi({
      submission: baseSubmission({
        submission_type: "CREATE",
        status: "FAILED",
        traces_status: "",
        error_message: "Payload validation failed",
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /resubmit to traces/i })).toBeInTheDocument(),
    );
  });

  it("keeps the surviving filing visible and actionable", async () => {
    // A failed amendment leaves the ORIGINAL filing untouched at TRACES. The
    // panel rendered "Failed" with no reference number and no way to act on
    // the statement that still exists — so the amendment could not even be
    // tried again.
    mockApi({ submission: failedModification("UPDATE") });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/the statement is still filed with traces/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("26FREQVKTA7K2V")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^amend$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument();
  });

  it("retries the amendment against the statement, not the failed row's state", async () => {
    // The endpoint takes a submission id but resolves the live filing from its
    // statement — which is what makes retrying from a FAILED UPDATE row work
    // at all. The client cannot pick the right row: the submissions list
    // serializer carries no `traces_status`.
    const submission = failedModification("UPDATE");
    mockApi({ submission });
    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^amend$/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /^amend$/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^amend$/i }));

    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        `/api/v1/traces/submissions/${submission.id}/amend/`,
        { method: "POST" },
      ),
    );
  });

  it("does not carry an error between actions on a failed modification either", async () => {
    // The first version of this fix only reset on the AVAILABLE branch's
    // buttons. Cancel is a plain button, not a `DialogClose`, so it never
    // fires `onOpenChange` — and the surviving-filing branch is exactly where
    // an officer lands after a failure, so it is where a stale error is most
    // likely and most confusing.
    const submission = baseSubmission({
      submission_type: "UPDATE",
      status: "FAILED",
      traces_status: "",
      traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
      traces_reference_number: "26FREQVKTA7K2V",
      error_message: "Amendment failed earlier",
    });
    mockApi({ submission });
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/amend/")) {
        return Promise.resolve(jsonRes({ detail: "Amendment window closed" }, 400));
      }
      if (url.includes("/auth/users/me/")) {
        return Promise.resolve(jsonRes({ id: "u1", role: "ADMIN", organization_id: "org-1" }));
      }
      if (url.includes("/traces/credentials/")) return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ results: [{ id: submission.id }] }));
      }
      if (url === `/api/v1/traces/submissions/${submission.id}/`) {
        return Promise.resolve(jsonRes(submission));
      }
      return Promise.resolve(jsonRes({}));
    });
    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^amend$/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /^amend$/i }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^amend$/i }));
    await waitFor(() =>
      expect(within(dialog).getByText(/amendment window closed/i)).toBeInTheDocument(),
    );
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/amendment window closed/i)).not.toBeInTheDocument();
  });

  it("does not show one action's error under the other", async () => {
    const submission = baseSubmission({
      traces_status: "AVAILABLE",
      traces_reference_number: "26FREQVKTA7K2V",
      submitted_at: "2026-06-30T00:00:00Z",
    });
    mockApi({ submission });
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/amend/")) {
        return Promise.resolve(jsonRes({ detail: "Amendment window closed" }, 400));
      }
      if (url.includes("/auth/users/me/")) {
        return Promise.resolve(jsonRes({ id: "u1", role: "ADMIN", organization_id: "org-1" }));
      }
      if (url.includes("/traces/credentials/")) return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ results: [{ id: submission.id }] }));
      }
      if (url === `/api/v1/traces/submissions/${submission.id}/`) {
        return Promise.resolve(jsonRes(submission));
      }
      return Promise.resolve(jsonRes({}));
    });
    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^amend$/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /^amend$/i }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^amend$/i }));
    await waitFor(() =>
      expect(within(dialog).getByText(/amendment window closed/i)).toBeInTheDocument(),
    );

    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await user.click(screen.getByRole("button", { name: /^withdraw$/i }));
    dialog = await screen.findByRole("dialog");

    // Otherwise the withdrawal dialog opens carrying an error about an
    // amendment — describing an action the reader did not take.
    expect(within(dialog).queryByText(/amendment window closed/i)).not.toBeInTheDocument();
  });
});

describe("TracesPanel — a filing that exists but whose status we could not read", () => {
  beforeEach(() => vi.clearAllMocks());

  /** `poll._fail_business_rejection` marks the row FAILED on a getDds SOAP
   * fault while leaving `traces_uuid` in place, because the filing itself is
   * fine. So a CREATE row can be FAILED *and* describe a live filing. */
  const filedButUnread = () =>
    baseSubmission({
      submission_type: "CREATE",
      status: "FAILED",
      traces_status: "SUBMITTED",
      traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
      traces_reference_number: "26FREQVKTA7K2V",
      error_message: "Unknown uuid",
    });

  it("never offers to resubmit a CREATE that already reached TRACES", async () => {
    // Keying on `submission_type` missed this case entirely: the row IS a
    // CREATE, so "Resubmit to TRACES" was offered for a statement TRACES
    // already holds — a second regulated declaration under a new reference
    // number. `traces_uuid` is the question, not the row's type.
    mockApi({ submission: filedButUnread() });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/what failed was checking its status/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /resubmit to traces/i }),
    ).not.toBeInTheDocument();
  });

  it("offers to re-read the status instead, and says that is what it does", async () => {
    // The backend re-polls this row rather than re-filing it. An officer told
    // to "resubmit" a statement TRACES already holds would reasonably expect
    // a second filing.
    mockApi({ submission: filedButUnread() });
    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    const button = await screen.findByRole("button", { name: /check status at traces/i });
    expect(screen.getByText("26FREQVKTA7K2V")).toBeInTheDocument();
    await user.click(button);

    await waitFor(() =>
      expect(mockAuthFetch).toHaveBeenCalledWith(
        "/api/v1/traces/submissions/sub-1/retry/",
        { method: "POST" },
      ),
    );
  });

  it("does not claim a statement is unsubmitted when the lookup itself failed", async () => {
    // A flat "Not submitted to TRACES." on a failed request is a claim about a
    // regulated filing, made most often for exactly the statements that are
    // filed. The page header already hides its withdraw control in this case.
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/users/me/")) {
        return Promise.resolve(jsonRes({ id: "u1", role: "ADMIN", organization_id: "org-1" }));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ detail: "Forbidden" }, 403));
      }
      return Promise.resolve(jsonRes({}));
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/could not load this statement/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/not submitted to traces/i)).not.toBeInTheDocument();
  });

  it("does not point at a message TRACES never sent", async () => {
    // `ErrorDetail` says "failed before TRACES could process it" for this row.
    // "Resolve the problem TRACES names above" then sends the officer looking
    // for something that is not there.
    mockApi({
      submission: baseSubmission({
        status: "FAILED",
        traces_status: "",
        error_message: "",
        error_detail: [],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);

    await waitFor(() =>
      expect(screen.getByText(/no detail was recorded for this failure/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/problem traces names above/i)).not.toBeInTheDocument();
  });
});

describe("TracesPanel — states the last review round found unactionable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps a remediation route on a REJECTED filing", async () => {
    // Keying resubmit off `traces_uuid` removed every action from a rejection:
    // a REJECTED row necessarily HAS a uuid — that is what getDds polled with
    // — so the panel showed a hint reading "then resubmit" above no button at
    // all. TRACES has finished with a rejected filing, so re-filing is not a
    // duplicate, and the backend has a matching carve-out.
    mockApi({
      submission: baseSubmission({
        traces_status: "REJECTED",
        traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
        error_detail: [{ field: "EUDR-X", message: "rule broken" }],
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /resubmit to traces/i })).toBeEnabled(),
    );
  });

  it("offers only the action that can succeed on a filed-but-unread CREATE", async () => {
    // Amend and withdraw need an AVAILABLE filing, and the status of this one
    // is exactly what we failed to read — so offering them would be two
    // guaranteed refusals beside the one action that works.
    mockApi({
      submission: baseSubmission({
        submission_type: "CREATE",
        status: "FAILED",
        traces_status: "SUBMITTED",
        traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /check status at traces/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^amend$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^withdraw$/i })).not.toBeInTheDocument();
  });

  it("does not invite the officer to copy an identifier that does not exist", async () => {
    // A CREATE that fails on its FIRST poll has neither number — only
    // `perform_poll` ever sets them.
    mockApi({
      submission: baseSubmission({
        submission_type: "CREATE",
        status: "FAILED",
        traces_status: "SUBMITTED",
        traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
        traces_reference_number: "",
        verification_number: "",
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/what failed was checking its status/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Reference Number")).not.toBeInTheDocument();
    expect(screen.queryByText("Verification Number")).not.toBeInTheDocument();
  });

  it("does not show a pending withdrawal as an available filing", async () => {
    // `withdrawDds` can answer with the filing's current status, and the poll
    // reads the same uuid — so the row carries AVAILABLE. Rendering it
    // directly said "Available" and offered a fresh 72-hour amendment window,
    // measured off the withdrawal's own timestamp, to someone who had just
    // withdrawn the statement.
    mockApi({
      submission: baseSubmission({
        submission_type: "WITHDRAW",
        status: "SUBMITTED",
        traces_status: "AVAILABLE",
        traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
        traces_reference_number: "26FREQVKTA7K2V",
        submitted_at: "2026-06-30T00:00:00Z",
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/waiting for traces to retract/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/amendment window/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^amend$/i })).not.toBeInTheDocument();
  });

  it("says the status is unknown, not that nothing was submitted, when the lookup fails", async () => {
    // Previously the copy said one thing while the badge said "Not submitted"
    // and the timeline said "Not yet submitted" — and the Submit button was
    // still rendered, disabled under a reason that was not the real one.
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/users/me/")) {
        return Promise.resolve(jsonRes({ id: "u1", role: "ADMIN", organization_id: "org-1" }));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ detail: "Server error" }, 500));
      }
      return Promise.resolve(jsonRes({}));
    });
    renderWithProviders(
      <TracesPanel ddsId="dds-1" ddsStatus="APPROVED" ddsCreatedAt="2026-06-01T00:00:00Z" />,
    );

    await waitFor(() =>
      expect(screen.getByText("Status unknown")).toBeInTheDocument(),
    );
    // The timeline's TRACES step must not assert a filing state either.
    expect(screen.getByText("Could not be read")).toBeInTheDocument();
    expect(screen.queryByText("Not yet submitted")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit to traces/i }),
    ).not.toBeInTheDocument();
  });

  it("describes an in-flight amendment as an amendment", async () => {
    mockApi({
      submission: baseSubmission({ submission_type: "UPDATE", status: "QUEUED" }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="SUBMITTED" />);

    await waitFor(() =>
      expect(screen.getByText(/sending the amendment to traces/i)).toBeInTheDocument(),
    );
  });
});
