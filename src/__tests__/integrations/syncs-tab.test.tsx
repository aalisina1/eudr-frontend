import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { SyncsTab } from "@/components/integrations/syncs-tab";
import { Toaster } from "@/components/ui/sonner";
import type { SyncConfig, SyncJob, SyncRecord } from "@/lib/api/types";

const mockJob: SyncJob = {
  id: "job-1",
  sync_config: "sync-1",
  status: "COMPLETED",
  triggered_by: "MANUAL",
  records_processed: 1,
  records_succeeded: 1,
  records_failed: 0,
  started_at: "2026-07-01T00:00:00Z",
  completed_at: "2026-07-01T00:01:00Z",
  error_message: "",
  created_at: "2026-07-01T00:00:00Z",
};

function mockRecord(overrides: Partial<SyncRecord>): SyncRecord {
  return {
    id: "rec-1",
    sync_job: "job-1",
    source_data: {},
    transformed_data: {},
    status: "PENDING_REVIEW",
    target_object_type: "BATCH",
    target_object_id: null,
    error_message: "",
    review_notes: "",
    reviewed_by_id: null,
    reviewed_at: null,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Navigates SyncsTab from the config list into the records view for
 * `mockJob`, so tests can select a record and exercise bulk-action/promote.
 */
async function navigateToRecords(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByText("Daily land plot sync")).toBeInTheDocument();
  });
  await user.click(screen.getByRole("button", { name: /jobs/i }));

  await waitFor(() => {
    expect(screen.getByText("MANUAL")).toBeInTheDocument();
  });
  const row = screen.getByText("MANUAL").closest("tr");
  if (!row) throw new Error("job row not found");
  await user.click(within(row).getByRole("button"));
}

const mockConfigs: SyncConfig[] = [
  {
    id: "sync-1",
    name: "Daily land plot sync",
    mapping: "mapping-1",
    mapping_name: "Land plots from parcels",
    schedule_cron: "0 2 * * *",
    requires_review: true,
    is_enabled: true,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
  },
];

const originalFetch = globalThis.fetch;

function renderSyncsTab() {
  return renderWithProviders(
    <>
      <SyncsTab />
      <Toaster />
    </>
  );
}

describe("SyncsTab toast wiring", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows an error toast (not inline text) when triggering a sync fails", async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/run/")) {
        return Promise.resolve(
          new Response(JSON.stringify({ detail: "Sync is already running" }), {
            status: 409,
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse(mockConfigs)), {
          status: 200,
        })
      );
    });

    renderSyncsTab();

    await waitFor(() => {
      expect(screen.getByText("Daily land plot sync")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /run now/i }));

    await waitFor(() => {
      expect(screen.getByText("Sync is already running")).toBeInTheDocument();
    });

    // The toast region announces politely and doesn't rely on inline <p> error text.
    expect(
      screen.queryByText("Failed to trigger sync")
    ).not.toBeInTheDocument();
  });

  it("shows a success toast when a sync run is triggered successfully", async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/run/")) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "queued" }), { status: 200 })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse(mockConfigs)), {
          status: 200,
        })
      );
    });

    renderSyncsTab();

    await waitFor(() => {
      expect(screen.getByText("Daily land plot sync")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /run now/i }));

    await waitFor(() => {
      expect(screen.getByText(/sync triggered/i)).toBeInTheDocument();
    });
  });
});

describe("SyncRecordsView request contracts", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Regression test for #88: the Promote button posted `sync_record_ids`
  // while the backend reads `ids`, so promote silently 400'd. Asserts the
  // actual request body, since the `satisfies` type guard only catches a
  // frontend-side typo, not a backend field rename.
  it("posts { ids } (not sync_record_ids) when promoting records", async () => {
    const user = userEvent.setup();
    const successRecord = mockRecord({ id: "rec-success", status: "SUCCESS" });
    let promoteBody: unknown = null;

    globalThis.fetch = vi.fn().mockImplementation(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/sync-records/promote/")) {
          promoteBody = JSON.parse(init?.body as string);
          return Promise.resolve(
            new Response(JSON.stringify({ promoted: 1, failed: 0 }), {
              status: 200,
            })
          );
        }
        if (url.includes("/sync-jobs/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockPaginatedResponse([mockJob])), {
              status: 200,
            })
          );
        }
        if (url.includes("status=SUCCESS")) {
          return Promise.resolve(
            new Response(
              JSON.stringify(mockPaginatedResponse([successRecord])),
              { status: 200 }
            )
          );
        }
        if (url.includes("/sync-records/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockPaginatedResponse([])), {
              status: 200,
            })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockPaginatedResponse(mockConfigs)), {
            status: 200,
          })
        );
      }
    );

    renderSyncsTab();
    await navigateToRecords(user);

    // Switch the status filter to Success so the promotable record shows up.
    await waitFor(() => {
      expect(screen.getByText("Sync records")).toBeInTheDocument();
    });
    await user.selectOptions(screen.getByRole("combobox"), "SUCCESS");

    await waitFor(() => {
      expect(screen.getByText("SUCCESS")).toBeInTheDocument();
    });

    const recordRow = screen.getByText("SUCCESS").closest("tr");
    if (!recordRow) throw new Error("record row not found");
    await user.click(within(recordRow).getByRole("checkbox"));

    await user.click(screen.getByRole("button", { name: /promote to core/i }));

    await waitFor(() => {
      expect(screen.getByText(/promoted 1 records/i)).toBeInTheDocument();
    });

    expect(promoteBody).toEqual({ ids: ["rec-success"] });
  });

  it("posts { ids, action } unchanged when bulk-approving records", async () => {
    const user = userEvent.setup();
    const pendingRecord = mockRecord({ id: "rec-pending", status: "PENDING_REVIEW" });
    let bulkActionBody: unknown = null;

    globalThis.fetch = vi.fn().mockImplementation(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/sync-records/bulk-action/")) {
          bulkActionBody = JSON.parse(init?.body as string);
          return Promise.resolve(
            new Response(JSON.stringify({ updated: 1 }), { status: 200 })
          );
        }
        if (url.includes("/sync-jobs/")) {
          return Promise.resolve(
            new Response(JSON.stringify(mockPaginatedResponse([mockJob])), {
              status: 200,
            })
          );
        }
        if (url.includes("/sync-records/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify(mockPaginatedResponse([pendingRecord])),
              { status: 200 }
            )
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify(mockPaginatedResponse(mockConfigs)), {
            status: 200,
          })
        );
      }
    );

    renderSyncsTab();
    await navigateToRecords(user);

    await waitFor(() => {
      expect(screen.getByText("PENDING REVIEW")).toBeInTheDocument();
    });

    const recordRow = screen.getByText("PENDING REVIEW").closest("tr");
    if (!recordRow) throw new Error("record row not found");
    await user.click(within(recordRow).getByRole("checkbox"));

    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(screen.getByText(/records approved/i)).toBeInTheDocument();
    });

    expect(bulkActionBody).toEqual({ ids: ["rec-pending"], action: "approve" });
  });
});
