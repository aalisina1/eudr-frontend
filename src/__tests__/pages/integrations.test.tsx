import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import IntegrationsPage from "@/app/(dashboard)/integrations/page";
import type { DataSource } from "@/lib/api/types";

const mockSources: DataSource[] = [
  {
    id: "ds-1",
    name: "Production SQL Server",
    source_type: "SQL_SERVER",
    connection_config: { host: "db.example.com", port: 1433, database: "prod" },
    connection_status: "CONNECTED",
    last_connected_at: "2026-03-10T12:00:00Z",
    is_active: true,
    schema_count: 5,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-10T00:00:00Z",
  },
  {
    id: "ds-2",
    name: "Monthly CSV Import",
    source_type: "CSV_UPLOAD",
    connection_status: "UNTESTED",
    last_connected_at: null,
    is_active: true,
    schema_count: 0,
    created_at: "2026-03-05T00:00:00Z",
    updated_at: "2026-03-05T00:00:00Z",
  },
];

const originalFetch = globalThis.fetch;

describe("IntegrationsPage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse(mockSources)),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the page title and description", () => {
    renderWithProviders(<IntegrationsPage />);
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(
      screen.getByText(/Connect external sources/)
    ).toBeInTheDocument();
  });

  it("renders New Source button", () => {
    renderWithProviders(<IntegrationsPage />);
    expect(screen.getByText("New Source")).toBeInTheDocument();
  });

  it("renders source cards after loading", async () => {
    renderWithProviders(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Production SQL Server")).toBeInTheDocument();
    });
    expect(screen.getByText("Monthly CSV Import")).toBeInTheDocument();
  });

  it("renders source type badges", async () => {
    renderWithProviders(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByText("SQL Server")).toBeInTheDocument();
    });
    expect(screen.getByText("CSV Upload")).toBeInTheDocument();
  });

  it("renders connection status badges", async () => {
    renderWithProviders(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
    expect(screen.getByText("Untested")).toBeInTheDocument();
  });

  it("renders schema count", async () => {
    renderWithProviders(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByText("5 objects")).toBeInTheDocument();
    });
    expect(screen.getByText("No objects")).toBeInTheDocument();
  });

  it("shows empty state when no sources exist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse([])),
        { status: 200 }
      )
    );

    renderWithProviders(<IntegrationsPage />);
    await waitFor(() => {
      expect(screen.getByText("No integrations yet")).toBeInTheDocument();
    });
  });
});
