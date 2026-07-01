import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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
});
