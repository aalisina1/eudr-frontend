import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockPaginatedResponse } from "./helpers";
import { DataTable, type ColumnDef } from "@/components/data-table";

interface MockItem {
  id: string;
  name: string;
  status: string;
}

const columns: ColumnDef<MockItem>[] = [
  { key: "name", header: "Name", sortable: true, render: (i) => i.name },
  { key: "status", header: "Status", render: (i) => i.status },
];

const mockItems: MockItem[] = [
  { id: "1", name: "Alpha", status: "active" },
  { id: "2", name: "Beta", status: "inactive" },
  { id: "3", name: "Gamma", status: "active" },
];

const originalFetch = globalThis.fetch;

describe("DataTable", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse(mockItems)),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders column headers", async () => {
    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
      />
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders data rows after loading", async () => {
    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-data"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("renders search input when searchable", async () => {
    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-search"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        searchable
        searchPlaceholder="Search items..."
      />
    );

    expect(screen.getByPlaceholderText("Search items...")).toBeInTheDocument();
  });

  it("does not render search input when not searchable", () => {
    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-no-search"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        searchable={false}
      />
    );

    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });

  it("renders export button when exportable", () => {
    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-export"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        exportable
      />
    );

    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("shows empty state when no results", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse([])),
        { status: 200 }
      )
    );

    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-empty"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        emptyTitle="Nothing here"
        emptyDescription="Add some items"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Nothing here")).toBeInTheDocument();
    });
    expect(screen.getByText("Add some items")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 })
    );

    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-error"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load data. Is the API running?")
      ).toBeInTheDocument();
    });
  });

  it("calls onRowClick when a row is clicked", async () => {
    const handleRowClick = vi.fn();

    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-click"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        onRowClick={handleRowClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Alpha"));
    expect(handleRowClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it("renders filter dropdowns", () => {
    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-filters"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        filters={[
          {
            key: "status",
            label: "All Statuses",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]}
      />
    );

    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  it("renders pagination when there are multiple pages", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse(mockItems, 60)),
        { status: 200 }
      )
    );

    renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-pagination"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        pageSize={20}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });

    // Should show pagination info
    expect(screen.getByText(/Showing 1–20 of 60/)).toBeInTheDocument();
  });
});
