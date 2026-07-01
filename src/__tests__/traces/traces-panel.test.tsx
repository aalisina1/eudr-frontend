import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";
import { TracesPanel } from "@/components/traces/traces-panel";
import type { TracesSubmission } from "@/lib/api/types";

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));
import { authFetch } from "@/lib/api/client";
const mockAuthFetch = vi.mocked(authFetch);

function jsonRes(data: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 400, json: async () => data } as Response;
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

function mockApi({ submission = null, hasCreds = true }: { submission?: TracesSubmission | null; hasCreds?: boolean }) {
  mockAuthFetch.mockImplementation((url: string) => {
    if (url.includes("/traces/credentials/")) {
      return Promise.resolve(jsonRes({ results: hasCreds ? [{ id: "c1" }] : [] }));
    }
    if (url.includes("/traces/submissions/?dds_id")) {
      return Promise.resolve(jsonRes({ results: submission ? [submission] : [] }));
    }
    return Promise.resolve(jsonRes({}));
  });
}

describe("TracesPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an enabled Submit action when no submission exists and credentials are present", async () => {
    mockApi({ submission: null, hasCreds: true });
    renderWithProviders(<TracesPanel ddsId="dds-1" activityType="IMPORT" />);
    await waitFor(() => expect(screen.getByText("Not submitted to TRACES.")).toBeInTheDocument());
    const btn = screen.getByRole("button", { name: /submit to traces/i });
    expect(btn).toBeEnabled();
  });

  it("disables Submit with a hint when no credentials are configured", async () => {
    mockApi({ submission: null, hasCreds: false });
    renderWithProviders(<TracesPanel ddsId="dds-1" />);
    await waitFor(() =>
      expect(screen.getByText(/configure traces credentials first/i)).toBeInTheDocument(),
    );
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
    renderWithProviders(<TracesPanel ddsId="dds-1" />);
    await waitFor(() => expect(screen.getByText("Available")).toBeInTheDocument());
    expect(screen.getByText("Reference Number")).toBeInTheDocument();
    expect(screen.getByText("REF-123")).toBeInTheDocument();
    expect(screen.getByText("Verification Number")).toBeInTheDocument();
    expect(screen.getByText("VER-456")).toBeInTheDocument();
  });

  it("shows the classified error and a resubmit action when REJECTED", async () => {
    mockApi({
      submission: baseSubmission({
        traces_status: "REJECTED",
        status: "SUBMITTED",
        error_message: "Geolocation polygon invalid for plot P1",
      }),
    });
    renderWithProviders(<TracesPanel ddsId="dds-1" />);
    await waitFor(() =>
      expect(screen.getByText(/geolocation polygon invalid/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /resubmit to traces/i })).toBeInTheDocument();
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
    renderWithProviders(<TracesPanel ddsId="dds-1" />);
    await waitFor(() => expect(screen.getByText(/amendment window/i)).toBeInTheDocument());
    expect(screen.getByText(/left to amend/i)).toBeInTheDocument();
  });

  it("submits via the confirm dialog and then shows the resulting submission", async () => {
    let submitted = false;
    mockAuthFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/traces/credentials/")) {
        return Promise.resolve(jsonRes({ results: [{ id: "c1" }] }));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(
          jsonRes({
            results: submitted
              ? [baseSubmission({ traces_status: "AVAILABLE", traces_reference_number: "REF-9", verification_number: "VER-9" })]
              : [],
          }),
        );
      }
      if (url === "/api/v1/traces/submissions/" && init?.method === "POST") {
        submitted = true;
        return Promise.resolve(jsonRes({ id: "sub-9", status: "QUEUED" }));
      }
      return Promise.resolve(jsonRes({}));
    });

    const user = userEvent.setup();
    renderWithProviders(<TracesPanel ddsId="dds-1" activityType="IMPORT" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /submit to traces/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /submit to traces/i }));
    // Confirm dialog opened; click its submit button (scoped to the dialog to disambiguate).
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /submit to traces/i }));
    await waitFor(() => expect(screen.getByText("REF-9")).toBeInTheDocument());
    expect(
      mockAuthFetch.mock.calls.some(
        ([u, i]) => u === "/api/v1/traces/submissions/" && (i as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
  });
});
