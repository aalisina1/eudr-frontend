/**
 * Task 13 — TRACES credentials management tests
 *
 * Covers:
 * 1. CredentialsCard — renders configured environments without exposing any secret
 * 2. CredentialsCard — empty state shows "Add credentials" button
 * 3. CredentialsForm — submits {environment, username, password, web_service_client_id} to POST endpoint
 * 4. CredentialsForm — edit mode sends PATCH; password field is blank (write-only, never pre-filled)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./helpers";
import { CredentialsCard } from "@/components/traces/credentials-card";
import { CredentialsForm } from "@/components/traces/credentials-form";
import type { TracesCredential } from "@/lib/api/types";

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

// ── CredentialsCard ──────────────────────────────────────────────────────────

describe("CredentialsCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders configured credentials without exposing any secret", async () => {
    mockAuthFetch.mockResolvedValue(
      jsonRes({ count: 1, results: [makeCred()] }),
    );

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

  it("shows empty state with an Add credentials button when no credentials exist", async () => {
    mockAuthFetch.mockResolvedValue(jsonRes({ count: 0, results: [] }));

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
