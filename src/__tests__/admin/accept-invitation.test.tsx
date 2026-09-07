import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { AcceptInvitation } from "@/components/admin/accept-invitation";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function renderPage(token: string) {
  return renderWithProviders(<AcceptInvitation token={token} />);
}

describe("Accepting an invitation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
  });

  it("shows the organisation and role before asking for anything", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          email: "newcomer@example.com",
          role: "COMPLIANCE_OFFICER",
          organization_name: "Kwame Cocoa",
          expires_at: "2026-09-13T00:00:00Z",
        }),
      })),
    );

    renderPage("abc");

    expect(await screen.findByText("Join Kwame Cocoa")).toBeInTheDocument();
    expect(
      await screen.findByText(/invited as a compliance officer/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Choose a password")).toBeInTheDocument();
  });

  it("explains a dead link instead of showing a form that cannot work", async () => {
    /* 410 covers used, withdrawn and expired. The page must not present a
     * password field the person can fill in and be refused. */
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 410, json: async () => ({}) })),
    );

    renderPage("dead");

    expect(await screen.findByText("This link has expired")).toBeInTheDocument();
    expect(
      await screen.findByText(/used, withdrawn or expired/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Choose a password")).not.toBeInTheDocument();
  });

  it("does not send credentials through authFetch", async () => {
    /* The invitee has no session. Routing an anonymous call through the
     * 401-refresh-retry path would bounce them to a login they cannot use. */
    const plainFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        email: "a@example.com",
        role: "VIEWER",
        organization_name: "Org",
        expires_at: "2026-09-13T00:00:00Z",
      }),
    }));
    vi.stubGlobal("fetch", plainFetch);

    renderPage("abc");

    await screen.findByText("Join Org");
    expect(plainFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/accounts/invitations/token/abc/"),
    );
  });
});
