import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import SettingsPage from "@/app/(dashboard)/settings/page";

const mockUser = {
  id: "u1",
  email: "admin@canopy.io",
  username: "admin",
  first_name: "Jane",
  last_name: "Doe",
  role: "ADMIN",
  organization_id: "org-abc-123",
  is_staff: true,
};

const originalFetch = globalThis.fetch;

describe("SettingsPage", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockUser), { status: 200 })
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders the page title", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders user profile info after loading", async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("@admin")).toBeInTheDocument();
    expect(screen.getByText("admin@canopy.io")).toBeInTheDocument();
  });

  it("displays the role badge", async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Administrator")).toBeInTheDocument();
    });
  });

  it("displays the organization ID", async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("org-abc-123")).toBeInTheDocument();
    });
  });

  it("renders app info section", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText("Canopy EUDR Compliance")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("EU 2023/1115")).toBeInTheDocument();
  });

  it("shows fallback when profile fails to load", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 401 })
    );

    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Unable to load profile.")
      ).toBeInTheDocument();
    });
  });
});
