import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { SourceCard } from "@/components/integrations/source-card";
import type { DataSource, IngestJob } from "@/lib/api/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const SOURCE: DataSource = {
  id: "src-1",
  name: "Postgres Prod",
  source_type: "SQL_SERVER",
  connection_status: "CONNECTED",
  last_connected_at: null,
  is_active: true,
  schema_count: 3,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

function job(status: IngestJob["status"]): IngestJob {
  return {
    id: "job-1",
    source: "src-1",
    source_name: "Postgres Prod",
    status,
    records_ingested: 10,
    records_failed: 0,
    started_at: "2026-06-21T01:00:00Z",
    completed_at: status === "RUNNING" ? null : "2026-06-21T01:02:00Z",
    error_message: "",
  };
}

function mockFetch(
  latest: IngestJob | null,
  ingestStatus = 200,
  ingestBody: unknown = {},
) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/ingest/")) {
      return new Response(JSON.stringify(ingestBody), { status: ingestStatus });
    }
    return new Response(
      JSON.stringify(mockPaginatedResponse(latest ? [latest] : [])),
      { status: 200 },
    );
  });
}

const origFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

describe("SourceCard", () => {
  it("shows the latest run status", async () => {
    globalThis.fetch = mockFetch(job("COMPLETED"));
    renderWithProviders(<SourceCard source={SOURCE} onNavigate={vi.fn()} />);
    expect(await screen.findByText(/completed/i)).toBeInTheDocument();
  });

  it("marks a running job and disables the run button", async () => {
    globalThis.fetch = mockFetch(job("RUNNING"));
    renderWithProviders(<SourceCard source={SOURCE} onNavigate={vi.fn()} />);
    expect(await screen.findByText(/running/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run now/i })).toBeDisabled();
  });

  it("triggers an ingest run without navigating to the detail page", async () => {
    const fetchMock = mockFetch(null);
    globalThis.fetch = fetchMock;
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<SourceCard source={SOURCE} onNavigate={onNavigate} />);
    const runBtn = await screen.findByRole("button", { name: /run now/i });
    await user.click(runBtn);

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]).includes("/ingest/") &&
          (c[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(postCall).toBeTruthy();
    });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("surfaces the backend's 409 (run already in progress) as an error toast and re-enables the button", async () => {
    // Cross-repo integration point with backend #25 (atomic overlap guard):
    // IngestSelectedObjectsView returns 409 + {"detail": "..."} when a run is
    // already in progress for the source. The run-now mutation must surface
    // that message via the shared #8 toast pattern, not a generic fallback,
    // and must not leave the button stuck in a disabled/pending state since
    // no job was actually created.
    globalThis.fetch = mockFetch(null, 409, {
      detail: "An ingestion run is already in progress for this source.",
    });
    const user = userEvent.setup();

    renderWithProviders(<SourceCard source={SOURCE} onNavigate={vi.fn()} />);
    const runBtn = await screen.findByRole("button", { name: /run now/i });
    await user.click(runBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "An ingestion run is already in progress for this source.",
      );
    });
    expect(runBtn).not.toBeDisabled();
  });
});
