/**
 * Issue #17 — TRACES operator identity (EORI + TRACES actor ID) admin UI.
 *
 * Covers:
 * 1. OperatorIdentityCard — displays EORI + actor ID without letting either be
 *    mistaken for an editable/secret field; actor ID shows a clear
 *    "not yet assigned" placeholder when blank (it's system-set after the
 *    first successful TRACES submission, per apps.accounts.models.Organization).
 * 2. OperatorIdentityCard — surfaces a distinct error state (not a misleading
 *    empty state) when the organization can't be loaded (e.g. 403 for a
 *    non-admin — GET /api/v1/accounts/organization/ is IsAdmin-gated).
 * 3. OperatorIdentityForm — pre-fills the current EORI number and PATCHes
 *    only {eori_number} to /api/v1/accounts/organization/.
 * 4. OperatorIdentityForm — a save failure (e.g. backend 403) surfaces via
 *    the shared #8 error-toast pattern (see source-card "run now" 409 test).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { renderWithProviders } from "../helpers";
import { OperatorIdentityCard } from "@/components/traces/operator-identity-card";
import { OperatorIdentityForm } from "@/components/traces/operator-identity-form";
import type { Organization } from "@/lib/api/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));
import { authFetch } from "@/lib/api/client";
const mockAuthFetch = vi.mocked(authFetch);

afterEach(() => {
  vi.clearAllMocks();
});

function jsonRes(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Canopy Trading GmbH",
    organization_type: "OPERATOR",
    country: "DE",
    vat_number: "DE123456789",
    eori_number: "DE12345678901234",
    traces_actor_id: "",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── OperatorIdentityCard ─────────────────────────────────────────────────────

describe("OperatorIdentityCard", () => {
  it("shows the operator EORI and a 'not yet assigned' placeholder for a blank TRACES actor ID", async () => {
    mockAuthFetch.mockResolvedValue(jsonRes(makeOrg()));

    renderWithProviders(<OperatorIdentityCard />);

    expect(await screen.findByText("DE12345678901234")).toBeInTheDocument();
    expect(screen.getByText(/not yet assigned/i)).toBeInTheDocument();
  });

  it("shows the assigned TRACES actor ID once TRACES has set one", async () => {
    mockAuthFetch.mockResolvedValue(
      jsonRes(makeOrg({ traces_actor_id: "EUDR-ACTOR-9981" })),
    );

    renderWithProviders(<OperatorIdentityCard />);

    expect(await screen.findByText("EUDR-ACTOR-9981")).toBeInTheDocument();
  });

  it("shows a distinct error state instead of blank/empty fields when the org fails to load (e.g. 403)", async () => {
    mockAuthFetch.mockResolvedValue(
      jsonRes({ detail: "You do not have permission to access this resource." }, 403),
    );

    renderWithProviders(<OperatorIdentityCard />);

    expect(
      await screen.findByText(/unable to load operator identity/i),
    ).toBeInTheDocument();
    // Must not fall through to a "not set" placeholder that reads as real data.
    expect(screen.queryByText(/not yet assigned/i)).not.toBeInTheDocument();
  });
});

// ── OperatorIdentityForm ─────────────────────────────────────────────────────

describe("OperatorIdentityForm", () => {
  it("pre-fills the current EORI number and PATCHes only {eori_number}", async () => {
    mockAuthFetch.mockResolvedValue(jsonRes(makeOrg()));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <OperatorIdentityForm
        open={true}
        onOpenChange={onOpenChange}
        organization={makeOrg()}
      />,
    );

    const eoriInput = screen.getByLabelText(/eori/i) as HTMLInputElement;
    expect(eoriInput.value).toBe("DE12345678901234");

    await user.clear(eoriInput);
    await user.type(eoriInput, "NL857702430");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());

    const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/accounts/organization/");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ eori_number: "NL857702430" });
  });

  it("surfaces a save failure (e.g. 403 for a non-admin) as an error toast", async () => {
    mockAuthFetch.mockResolvedValue(
      jsonRes({ detail: "You do not have permission to perform this action." }, 403),
    );
    const user = userEvent.setup();

    renderWithProviders(
      <OperatorIdentityForm
        open={true}
        onOpenChange={vi.fn()}
        organization={makeOrg()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "You do not have permission to perform this action.",
      );
    });
  });

  it("calls toast.success and closes the sheet on a successful save", async () => {
    mockAuthFetch.mockResolvedValue(jsonRes(makeOrg({ eori_number: "NL857702430" })));
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <OperatorIdentityForm
        open={true}
        onOpenChange={onOpenChange}
        organization={makeOrg()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
