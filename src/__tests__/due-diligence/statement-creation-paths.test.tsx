/**
 * A statement is created from a purchase order, and nowhere else.
 *
 * Two other paths existed, and both produced statements that could never be
 * filed:
 *
 *   1. Submissions → "New Statement" opened `DDSForm`, which has no lot
 *      selection at all. `commodities` is mandatory in the TRACES XSD (the
 *      element carries no `minOccurs`, so it defaults to 1), so a statement
 *      covering nothing is schema-invalid for *every* statement type. Four such
 *      statements are live in production.
 *   2. The composer's "Add lots from other POs" opened the same form — a button
 *      promising exactly the thing that form cannot do.
 *
 * The EUDR flow those gestured at is real, but it is not this: Information
 * System release 8.2.1 (Aug 2026) added **Group Heads**, which reference up to
 * 1000 previously-submitted DDS or SD members and *still carry commodities of
 * their own*. Supporting it means storing each member's reference and
 * verification number, which neither form collects. See
 * `eudr-vault/10-Specs/regulatory-changes-2026.md`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import DueDiligencePage from "@/app/(dashboard)/submissions/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/submissions",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function emptyApi() {
  globalThis.fetch = vi.fn(async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ count: 0, results: [] }),
    }) as Response,
  );
}

describe("Submissions — no lotless create path", () => {
  it("offers no control that creates a statement covering nothing", async () => {
    emptyApi();
    renderWithProviders(<DueDiligencePage />);

    expect(screen.queryByRole("button", { name: /new statement/i })).toBeNull();
  });

  it("points at the purchase order instead, which is where a statement starts", async () => {
    emptyApi();
    renderWithProviders(<DueDiligencePage />);

    expect(
      await screen.findByRole("link", { name: /purchase order/i }),
    ).toHaveAttribute("href", "/sourcing");
  });

  it("still lists statements", async () => {
    /** Negative control: removing the create path must not break the page's
     * actual job. */
    emptyApi();
    renderWithProviders(<DueDiligencePage />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Submissions",
    );
  });
});
