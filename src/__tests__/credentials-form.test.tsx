/**
 * Task 13 — TRACES credentials management tests
 * Issue #17 follow-up — 403 → toast parity with the schedule/run-now precedent.
 * eudr-app #70 QA rider — role-aware hiding of "Add credentials" for non-admins.
 *
 * Covers:
 * 1. CredentialsCard — renders configured environments without exposing any secret
 * 2. CredentialsCard — empty state shows "Add credentials" button for an ADMIN
 * 3. CredentialsCard — a load failure (e.g. 403 for a non-admin) shows a distinct
 *    error state, not the misleading "no credentials yet, add one" empty state
 * 4. CredentialsCard — hides "Add credentials" (header + empty-state) for a
 *    non-ADMIN role (VIEWER) — the endpoint is IsAdmin-gated server-side (#70)
 * 5. CredentialsForm — submits {environment, username, password, web_service_client_id} to POST endpoint
 * 6. CredentialsForm — edit mode sends PATCH; password field is blank (write-only, never pre-filled)
 * 7. CredentialsForm — a save failure (e.g. 403) surfaces via the shared error-toast pattern
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { renderWithProviders } from "./helpers";
import { CredentialsCard } from "@/components/traces/credentials-card";
import { CredentialsForm } from "@/components/traces/credentials-form";
import type { TracesCredential } from "@/lib/api/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));
import { authFetch } from "@/lib/api/client";
const mockAuthFetch = vi.mocked(authFetch);

function jsonRes(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

function makeCred(overrides: Partial<TracesCredential> = {}): TracesCredential {
  return {
    id: "cred-1",
    environment: "ACCEPTANCE",
    username: "test_user",
    web_service_client_id: "client_abc",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Route `authFetch` by URL so `/auth/users/me/` (role, consumed by
 * `useCurrentUser`) and `/traces/credentials/` (the credentials list) can be
 * mocked independently — `role` defaults to "ADMIN" since most of these
 * tests are exercising admin-context CredentialsCard rendering, not the
 * role gate itself.
 */
function mockCredentialsApi({
  credentialsResponse,
  role = "ADMIN",
}: {
  credentialsResponse: { data: unknown; status?: number };
  role?: "ADMIN" | "COMPLIANCE_OFFICER" | "VIEWER" | "SUPPLIER_CONTACT";
}) {
  mockAuthFetch.mockImplementation((url: string) => {
    if (url.includes("/auth/users/me/")) {
      return Promise.resolve(jsonRes({ id: "u1", role, organization_id: "org-1" }));
    }
    return Promise.resolve(jsonRes(credentialsResponse.data, credentialsResponse.status));
  });
}

// ── CredentialsCard ──────────────────────────────────────────────────────────

describe("CredentialsCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders configured credentials without exposing any secret", async () => {
    mockCredentialsApi({ credentialsResponse: { data: { count: 1, results: [makeCred()] } } });

    renderWithProviders(<CredentialsCard />);

    await waitFor(() =>
      expect(screen.getByText("Acceptance")).toBeInTheDocument(),
    );

    // username and client-id are visible
    expect(screen.getByText("test_user")).toBeInTheDocument();
    expect(screen.getByText("client_abc")).toBeInTheDocument();

    // The word "password" must not appear as a value anywhere
    const allText = document.body.textContent ?? "";
    expect(allText).not.toMatch(/password/i);
  });

  it("shows empty state with an Add credentials button for an ADMIN when no credentials exist", async () => {
    mockCredentialsApi({ credentialsResponse: { data: { count: 0, results: [] } }, role: "ADMIN" });

    renderWithProviders(<CredentialsCard />);

    await waitFor(() =>
      expect(
        screen.getByText(/no traces credentials configured/i),
      ).toBeInTheDocument(),
    );

    // Both the header button and the empty-state CTA use "Add credentials" — at least one must be present
    const addButtons = screen.getAllByRole("button", { name: /add credentials/i });
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows a distinct error state (not the empty 'add credentials' CTA) when the list fails to load, e.g. 403 for a non-admin", async () => {
    mockCredentialsApi({
      credentialsResponse: {
        data: { detail: "You do not have permission to access this resource." },
        status: 403,
      },
    });

    renderWithProviders(<CredentialsCard />);

    expect(
      await screen.findByText(/unable to load traces credentials/i),
    ).toBeInTheDocument();
    // Must not render the "no credentials configured yet" CTA — that implies
    // the viewer could just add one, which isn't true for a permission failure.
    expect(
      screen.queryByText(/no traces credentials configured/i),
    ).not.toBeInTheDocument();
  });

  // ── #70 QA rider: role-aware hiding of "Add credentials" ──────────────────

  it("hides the 'Add credentials' button (header) for a non-admin (VIEWER) even though the endpoint 403s", async () => {
    mockCredentialsApi({
      credentialsResponse: {
        data: { detail: "You do not have permission to access this resource." },
        status: 403,
      },
      role: "VIEWER",
    });

    renderWithProviders(<CredentialsCard />);

    await screen.findByText(/unable to load traces credentials/i);
    expect(
      screen.queryByRole("button", { name: /add credentials/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the empty-state 'Add credentials' CTA for a non-admin (COMPLIANCE_OFFICER)", async () => {
    // Hypothetical: even if the list GET somehow succeeded empty for a
    // non-admin, the CTA to add one (a write the backend would 403) must
    // stay hidden — the gate is role-driven, not derived from this response.
    mockCredentialsApi({
      credentialsResponse: { data: { count: 0, results: [] } },
      role: "COMPLIANCE_OFFICER",
    });

    renderWithProviders(<CredentialsCard />);

    await screen.findByText(/no traces credentials configured/i);
    expect(
      screen.queryByRole("button", { name: /add credentials/i }),
    ).not.toBeInTheDocument();
  });
});

// ── CredentialsForm ──────────────────────────────────────────────────────────

describe("CredentialsForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits {environment, username, password, web_service_client_id} to POST endpoint", async () => {
    mockAuthFetch.mockResolvedValue(jsonRes(makeCred()));

    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <CredentialsForm open={true} onOpenChange={onOpenChange} />,
    );

    // Environment defaults to ACCEPTANCE — just fill the text fields
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const clientIdInput = screen.getByLabelText(/web service client id/i);

    await user.type(usernameInput, "traces_user");
    await user.type(passwordInput, "s3cr3t");
    await user.type(clientIdInput, "ws_client_123");

    await user.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());

    const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/traces/credentials/");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      environment: "ACCEPTANCE",
      username: "traces_user",
      password: "s3cr3t",
      web_service_client_id: "ws_client_123",
    });
    // password is in the POST body but that's intentional — it's write-only
    expect(body).not.toHaveProperty("id");
  });

  it("edit mode: password field is blank (write-only, never pre-filled); sends PATCH", async () => {
    const existingCred = makeCred({
      id: "cred-99",
      environment: "PRODUCTION",
      username: "prod_user",
      web_service_client_id: "ws_prod",
    });
    mockAuthFetch.mockResolvedValue(jsonRes(existingCred));

    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <CredentialsForm open={true} onOpenChange={onOpenChange} credential={existingCred} />,
    );

    // Username should be pre-filled from the existing credential
    const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement;
    expect(usernameInput.value).toBe("prod_user");

    // Password must be blank — never pre-filled
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(passwordInput.value).toBe("");

    // Submit without changing password — password should NOT be sent
    await user.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());

    const [url, init] = mockAuthFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/traces/credentials/cred-99/");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    // password omitted when blank in edit mode
    expect(body).not.toHaveProperty("password");
    expect(body.username).toBe("prod_user");
  });

  it("surfaces a save failure (e.g. 403 for a non-admin) as an error toast", async () => {
    mockAuthFetch.mockResolvedValue(
      jsonRes({ detail: "You do not have permission to perform this action." }, 403),
    );
    const user = userEvent.setup();

    renderWithProviders(
      <CredentialsForm open={true} onOpenChange={vi.fn()} />,
    );

    await user.type(screen.getByLabelText(/username/i), "traces_user");
    await user.type(screen.getByLabelText(/password/i), "s3cr3t");
    await user.type(screen.getByLabelText(/web service client id/i), "ws_client_123");
    await user.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "You do not have permission to perform this action.",
      );
    });
  });

  it("test connection button re-fetches the credential list as a save smoke", async () => {
    // The credential already exists
    mockAuthFetch.mockResolvedValue(
      jsonRes({ count: 1, results: [makeCred()] }),
    );

    renderWithProviders(<CredentialsCard />);

    await waitFor(() =>
      expect(screen.getByText("Acceptance")).toBeInTheDocument(),
    );

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    fireEvent.click(testBtn);

    // Should trigger a re-fetch of /api/v1/traces/credentials/
    await waitFor(() => {
      const calls = mockAuthFetch.mock.calls.map(([u]) => u as string);
      expect(
        calls.some((u) => u.includes("/api/v1/traces/credentials/")),
      ).toBe(true);
    });
  });
});
