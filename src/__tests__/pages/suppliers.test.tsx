import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithProviders,
  mockPaginatedResponse,
} from "../helpers";
import SuppliersPage from "@/app/(dashboard)/suppliers/page";
import type { Supplier } from "@/lib/api/types";

const mockSuppliers: Supplier[] = [
  {
    id: "s1",
    name: "Green Farm Co",
    country_of_origin: "Brazil",
    kyc_status: "VERIFIED",
    risk_rating: "LOW",
    external_id: "EXT-001",
    managed_by_id: "org-1",
    supplier_organization_id: null,
    kyc_verified_at: "2026-01-15T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  },
  {
    id: "s2",
    name: "Timber Ltd",
    country_of_origin: "Indonesia",
    kyc_status: "PENDING",
    risk_rating: "HIGH",
    external_id: "",
    managed_by_id: "org-1",
    supplier_organization_id: null,
    kyc_verified_at: null,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
];

const originalFetch = globalThis.fetch;

describe("SuppliersPage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(mockPaginatedResponse(mockSuppliers)),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the page title", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(
      screen.getByText("Manage your supply chain partners")
    ).toBeInTheDocument();
  });

  it("renders the Add Supplier button", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("Add Supplier")).toBeInTheDocument();
  });

  it("renders supplier names after loading", async () => {
    renderWithProviders(<SuppliersPage />);
    await waitFor(() => {
      expect(screen.getByText("Green Farm Co")).toBeInTheDocument();
    });
    expect(screen.getByText("Timber Ltd")).toBeInTheDocument();
  });

  it("renders KYC status badges", async () => {
    renderWithProviders(<SuppliersPage />);
    await waitFor(() => {
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders risk rating badges", async () => {
    renderWithProviders(<SuppliersPage />);
    await waitFor(() => {
      expect(screen.getByText("Low")).toBeInTheDocument();
    });
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders filter dropdowns", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("All KYC Status")).toBeInTheDocument();
    expect(screen.getByText("All Risk Levels")).toBeInTheDocument();
  });

  it("renders export CSV button", () => {
    renderWithProviders(<SuppliersPage />);
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });
});
