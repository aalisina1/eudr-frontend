import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { AdministrationSection } from "@/components/admin/administration-section";

vi.mock("@/lib/api/client", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "@/lib/api/client";

const mockAuthFetch = vi.mocked(authFetch);

function asUser(role: string) {
  mockAuthFetch.mockImplementation(async (...args: unknown[]) => {
    const url = String(args[0] ?? "");
    const body = url.includes("/auth/users/me/")
      ? { id: "u1", email: "a@example.com", role }
      : mockPaginatedResponse([]);
    return { ok: true, status: 200, json: async () => body } as Response;
  });
}

describe("AdministrationSection role gate", () => {
  beforeEach(() => mockAuthFetch.mockReset());

  /** Waiting for the fetch to be *called* is not enough: the component returns
   * null while the user query is in flight, so an assertion made then passes
   * whether or not the role gate exists. Wait for the query to have resolved,
   * then assert. Proven by mutation: deleting the gate reddens both tests. */
  async function renderResolved() {
    const rendered = renderWithProviders(<AdministrationSection />);
    await waitFor(() =>
      expect(rendered.queryClient.getQueryState(["me"])?.status).toBe("success"),
    );
    return rendered;
  }

  it("renders nothing at all for a non-admin", async () => {
    asUser("COMPLIANCE_OFFICER");

    const { container } = await renderResolved();

    // Absent from the DOM, not disabled: a role that cannot administer must
    // not be shown the controls at all.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/administration/i)).not.toBeInTheDocument();
  });

  it("renders nothing for a viewer", async () => {
    asUser("VIEWER");

    const { container } = await renderResolved();

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the three sections for an admin", async () => {
    asUser("ADMIN");

    renderWithProviders(<AdministrationSection />);

    // Matched on each card's own description rather than its title: "Groups"
    // is also a column header in the people table, and shadcn's CardTitle is
    // not a heading element.
    expect(await screen.findByText("Administration")).toBeInTheDocument();
    expect(await screen.findByText(/Everyone with access to this organisation/)).toBeInTheDocument();
    expect(await screen.findByText(/A link works once and expires/)).toBeInTheDocument();
    expect(await screen.findByText(/A group grants one role to everyone in it/)).toBeInTheDocument();
  });
});
