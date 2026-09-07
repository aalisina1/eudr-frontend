import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { UsersCard } from "@/components/admin/users-card";
import type { OrgUser } from "@/lib/api/types";

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));
import { authFetch } from "@/lib/api/client";
const mockAuthFetch = vi.mocked(authFetch);

function user(overrides: Partial<OrgUser>): OrgUser {
  return {
    id: "u1",
    email: "person@example.com",
    first_name: "",
    last_name: "",
    role: "VIEWER",
    effective_role: "VIEWER",
    access_groups: [],
    is_active: true,
    ...overrides,
  };
}

function serve(rows: OrgUser[]) {
  mockAuthFetch.mockImplementation(
    async () =>
      ({ ok: true, status: 200, json: async () => mockPaginatedResponse(rows) }) as Response,
  );
}

describe("UsersCard", () => {
  beforeEach(() => mockAuthFetch.mockReset());

  it("says where an inherited role comes from", async () => {
    /* An administrator who cannot see *why* someone is an administrator can
     * observe access but not manage it. */
    serve([
      user({
        role: "VIEWER",
        effective_role: "COMPLIANCE_OFFICER",
        access_groups: [{ id: "g1", name: "Compliance team", role: "COMPLIANCE_OFFICER" }],
      }),
    ]);

    renderWithProviders(<UsersCard currentUserId="someone-else" />);

    expect(await screen.findByText("Compliance officer")).toBeInTheDocument();
    expect(await screen.findByText("via Compliance team")).toBeInTheDocument();
  });

  it("says when a role is held directly", async () => {
    serve([user({ role: "ADMIN", effective_role: "ADMIN" })]);

    renderWithProviders(<UsersCard currentUserId="someone-else" />);

    expect(await screen.findByText("granted directly")).toBeInTheDocument();
  });

  it("offers no deactivate control against your own row", async () => {
    serve([user({ id: "me", role: "ADMIN", effective_role: "ADMIN" })]);

    renderWithProviders(<UsersCard currentUserId="me" />);

    expect(await screen.findByText("You")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("shows a deactivated person as reactivatable rather than hiding them", async () => {
    serve([user({ is_active: false })]);

    renderWithProviders(<UsersCard currentUserId="someone-else" />);

    expect(await screen.findByText("Deactivated")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reactivate" })).toBeInTheDocument();
  });
});
