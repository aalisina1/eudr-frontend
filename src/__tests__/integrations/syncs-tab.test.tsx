import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { SyncsTab } from "@/components/integrations/syncs-tab";
import { Toaster } from "@/components/ui/sonner";
import type { SyncConfig } from "@/lib/api/types";

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
