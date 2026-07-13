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
  organization_name: "Canopy Trading GmbH",
  is_staff: true,
};

const originalFetch = globalThis.fetch;

/**
 * Create a fresh Response per call so the body is never double-consumed.
 * The settings page now issues multiple fetches (profile + TRACES credentials),
 * so we route by URL and always build a new Response object.
 */
function makeFetchMock(userOk = true) {
  return vi.fn().mockImplementation((url: string) => {
    const u = typeof url === "string" ? url : (url as Request).url ?? "";
    if (u.includes("/traces/credentials/")) {
      // Return an empty list so the CredentialsCard renders the empty state quietly
      return Promise.resolve(
        new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 }),
      );
    }
    // Default: user profile endpoint
    return Promise.resolve(
      new Response(
        JSON.stringify(userOk ? mockUser : {}),
        { status: userOk ? 200 : 401 },
      ),
    );
  });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    globalThis.fetch = makeFetchMock();
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

  it("displays the organization name (eudr-app #72/#70)", async () => {
    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Canopy Trading GmbH")).toBeInTheDocument();
    });
  });

  it("renders app info section", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText("Canopy EUDR Compliance")).toBeInTheDocument();
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("EU 2023/1115")).toBeInTheDocument();
  });

  it("shows fallback when profile fails to load", async () => {
    globalThis.fetch = makeFetchMock(false);

    renderWithProviders(<SettingsPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Unable to load profile.")
      ).toBeInTheDocument();
    });
  });
});
