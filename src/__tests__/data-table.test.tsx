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

  it("stays on page 2 after clicking Next, for a caller that does not pass extraParams (regression)", async () => {
    // A fresh Response per call — a single shared Response instance can only
    // have its body read once, and the fix under test legitimately causes
    // more than one fetch.
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify(mockPaginatedResponse(mockItems, 60)),
          { status: 200 }
        )
    );
    globalThis.fetch = fetchMock;

    // Mounted exactly like an existing consumer (suppliers/documents/due
    // diligence pages) that never passes extraParams at all.
    const { container } = renderWithProviders(
      <DataTable<MockItem>
        queryKey="test-no-extraparams"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        pageSize={20}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });

    const buttons = container.querySelectorAll("button");
    const nextButton = buttons[buttons.length - 1];

    const user = userEvent.setup();
    await user.click(nextButton);

    // The bug: a fresh `extraParams = {}` default reference on every render
    // makes the page-reset effect re-fire after the click and silently
    // bounce back to page 1 (an unrequested offset=0 fetch right after the
    // offset=20 one for page 2).
    await waitFor(() => {
      expect(screen.getByText(/Showing 21–40 of 60/)).toBeInTheDocument();
    });

    // Fetch sequence should be [initial offset=0, then offset=20 for page 2]
    // and stay there — the bug produced an extra, unrequested offset=0 fetch
    // right after the offset=20 one, silently landing back on page 1.
    const offsets = fetchMock.mock.calls
      .map(([url]) => new URL(String(url), "http://localhost").searchParams.get("offset"))
      .filter((o): o is string => o !== null);
    expect(offsets[offsets.length - 1]).toBe("20");
    expect(offsets.filter((o) => o === "0")).toHaveLength(1);
  });

  it("keeps pagination stable across a rerender with a fresh inline (non-memoized) extraParams literal", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify(mockPaginatedResponse(mockItems, 60)),
          { status: 200 }
        )
    );
    globalThis.fetch = fetchMock;

    const makeElement = () => (
      <DataTable<MockItem>
        queryKey="test-inline-extraparams"
        endpoint="/api/v1/test/"
        columns={columns}
        rowKey={(i) => i.id}
        pageSize={20}
        // Deliberately NOT memoized — a fresh object literal every time this
        // is (re-)evaluated, as a real (non-useMemo) caller would produce on
        // its own unrelated re-renders.
        extraParams={{ status: "active" }}
      />
    );

    const { container, rerender } = renderWithProviders(makeElement());

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });

    const buttons = container.querySelectorAll("button");
    const nextButton = buttons[buttons.length - 1];

    const user = userEvent.setup();
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Showing 21–40 of 60/)).toBeInTheDocument();
    });

    // Simulate the caller re-rendering (e.g. unrelated parent state change)
    // and handing DataTable a brand-new but content-identical extraParams
    // object — this must not be mistaken for a real params change.
    rerender(makeElement());

    await waitFor(() => {
      expect(screen.getByText(/Showing 21–40 of 60/)).toBeInTheDocument();
    });
  });
});
