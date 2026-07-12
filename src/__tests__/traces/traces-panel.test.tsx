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
 */
function mockApi({
  submission = null,
  hasCreds = true,
}: {
  submission?: TracesSubmission | null;
  hasCreds?: boolean;
}) {
  mockAuthFetch.mockImplementation((url: string) => {
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

  it("disables Submit with a hint when no credentials are configured", async () => {
    mockApi({ submission: null, hasCreds: false });
    renderWithProviders(<TracesPanel ddsId="dds-1" ddsStatus="APPROVED" />);
    await waitFor(() =>
      expect(screen.getByText(/configure traces credentials first/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /submit to traces/i })).toBeDisabled();
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
