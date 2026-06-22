import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";
import { ScheduleSection } from "@/components/integrations/schedule-section";
import type { IngestionSchedule } from "@/lib/api/types";

const SCHEDULE: IngestionSchedule = {
  id: "sched-1",
  source_id: "src-1",
  source_name: "Postgres Prod",
  schedule_type: "CRON",
  cron_expression: "0 2 * * *",
  timezone: "UTC",
  interval_seconds: null,
  is_enabled: true,
  last_run_at: "2026-06-21T02:00:00Z",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-20T00:00:00Z",
};

const origFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = origFetch;
  vi.restoreAllMocks();
});

describe("ScheduleSection", () => {
  it("loads an existing schedule and shows a human-readable preview", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(SCHEDULE), { status: 200 }));

    renderWithProviders(<ScheduleSection sourceId="src-1" />);

    expect(await screen.findByDisplayValue("0 2 * * *")).toBeInTheDocument();
    expect(screen.getByText(/At 02:00/)).toBeInTheDocument();
  });

  it("shows the editor when no schedule exists yet (404)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: "No schedule configured." }), {
          status: 404,
        }),
      );

    renderWithProviders(<ScheduleSection sourceId="src-1" />);

    expect(await screen.findByLabelText(/cron expression/i)).toBeInTheDocument();
  });

  it("disables Save when an enabled schedule has an invalid cron", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(SCHEDULE), { status: 200 }));
    const user = userEvent.setup();

    renderWithProviders(<ScheduleSection sourceId="src-1" />);

    const input = await screen.findByLabelText(/cron expression/i);
    await user.clear(input);
    await user.type(input, "bad");

    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("persists the schedule via a PUT request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(SCHEDULE), { status: 200 }),
      )
      .mockResolvedValue(new Response(JSON.stringify(SCHEDULE), { status: 200 }));
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();

    renderWithProviders(<ScheduleSection sourceId="src-1" />);
    await screen.findByDisplayValue("0 2 * * *");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
    });
  });
});
