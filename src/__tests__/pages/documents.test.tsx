import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import DocumentsPage from "@/app/(dashboard)/documents/page";

const originalFetch = globalThis.fetch;

describe("DocumentsPage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse([])),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the page title", () => {
    renderWithProviders(<DocumentsPage />);
    expect(screen.getByText("Documents")).toBeInTheDocument();
  });

  it("renders the Add Document button", () => {
    renderWithProviders(<DocumentsPage />);
    expect(screen.getByText("Add Document")).toBeInTheDocument();
  });

  it("renders the export button", () => {
    renderWithProviders(<DocumentsPage />);
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });
});
