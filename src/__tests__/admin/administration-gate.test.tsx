import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import AdministrationLayout from "@/app/(dashboard)/administration/layout";

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));
import { authFetch } from "@/lib/api/client";
const mockAuthFetch = vi.mocked(authFetch);

function asUser(role: string) {
  mockAuthFetch.mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ id: "u1", email: "a@example.com", role }),
      }) as Response,
  );
}

/** The layout returns null while the user query is in flight, so asserting
 * before it resolves passes whether or not the gate exists. Wait for the query,
 * then assert — mutation-proven: removing the role check reddens these. */
async function renderResolved() {
  const rendered = renderWithProviders(
    <AdministrationLayout>
      <p>Administration content</p>
    </AdministrationLayout>,
  );
  await waitFor(() =>
    expect(rendered.queryClient.getQueryState(["me"])?.status).toBe("success"),
  );
  return rendered;
}

describe("Administration route gate", () => {
  beforeEach(() => mockAuthFetch.mockReset());

  it("lets an administrator through", async () => {
    asUser("ADMIN");

    await renderResolved();

    expect(screen.getByText("Administration content")).toBeInTheDocument();
  });

  it.each(["COMPLIANCE_OFFICER", "VIEWER", "SUPPLIER_CONTACT"])(
    "keeps %s out and says why",
    async (role) => {
      asUser(role);

      await renderResolved();

      expect(screen.queryByText("Administration content")).not.toBeInTheDocument();
      expect(
        screen.getByText("Administration is for administrators"),
      ).toBeInTheDocument();
    },
  );

  it("offers a way onward rather than a dead end", async () => {
    /* Bouncing someone somewhere else with no reason given is how people
     * conclude the product is broken. */
    asUser("VIEWER");

    await renderResolved();

    expect(
      screen.getByRole("link", { name: "Go to your settings" }),
    ).toHaveAttribute("href", "/settings");
  });
});
