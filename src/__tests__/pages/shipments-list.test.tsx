import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import ShipmentsPage from "@/app/(dashboard)/shipments/page";
import type { ConsignmentRow, User } from "@/lib/api/types";

// File-level mock (house pattern — see file-dds-composer-routing.test.tsx):
// the global next/navigation mock in setup.ts can't assert router calls, and
// the SUPPLIER_CONTACT redirect test below needs to assert `replace` was
// called with "/dashboard".
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/shipments",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); vi.clearAllMocks(); });

// Countdown dates are computed from the real clock — daysUntil() uses
// Date.now() and nothing in the suite fakes time, so a hardcoded date would
// flip the badge to "RED · -N d" the day after it passes and fail forever.
const IN_4_DAYS = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);

function row(over: Partial<ConsignmentRow> = {}): ConsignmentRow {
  return {
    id: "c1", reference: "BL-RED-1", expected_clearance_date: IN_4_DAYS,
    tracking_number: null, t49_request_id: null, latest_eta: null, eta_source: "NONE",
    created_at: "2026-07-20T00:00:00Z", rag: "RED", covered_count: 0, total_count: 2,
    countdown_to: IN_4_DAYS, ...over,
  };
}

function mockApi(rows: ConsignmentRow[], role: User["role"] = "COMPLIANCE_OFFICER") {
  const calls: string[] = [];
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    if (url.includes("/auth/users/me/"))
      return Promise.resolve(new Response(JSON.stringify({ id: "u1", role } as Partial<User>), { status: 200 }));
    if (url.includes("/supply-chain/consignments/"))
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(rows)), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
  return calls;
}

async function renderPage() {
  let r!: ReturnType<typeof renderWithProviders>;
  await act(async () => { r = renderWithProviders(<ShipmentsPage />); });
  return r;
}

describe("/shipments list", () => {
  it("renders consignment rows with RAG + coverage", async () => {
    mockApi([row()]);
    await renderPage();
    await waitFor(() => expect(screen.getByText("BL-RED-1")).toBeInTheDocument());
    // day count varies with rounding around midnight — assert digits, not "4"
    expect(screen.getByText(/RED · \d+ d/)).toBeInTheDocument();
    expect(screen.getByText(/0\/2/)).toBeInTheDocument();
  });

  it("shows the New consignment button for COMPLIANCE_OFFICER", async () => {
    mockApi([row()], "COMPLIANCE_OFFICER");
    await renderPage();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /New consignment/i }).length).toBeGreaterThan(0));
  });

  it("hides the New consignment button for VIEWER", async () => {
    mockApi([row()], "VIEWER");
    await renderPage();
    await waitFor(() => expect(screen.getByText("BL-RED-1")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /New consignment/i })).not.toBeInTheDocument();
  });

  it("sends rag and countdown_after filter params to the API", async () => {
    const calls = mockApi([row()]);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => expect(screen.getByText("BL-RED-1")).toBeInTheDocument());

    // Select "Red" in the RAG filter
    const ragSelect = screen.getByLabelText(/RAG status/i);
    await user.selectOptions(ragSelect, "RED");

    // Type a date into the "Lands after" input
    const afterInput = screen.getByLabelText(/Lands after/i);
    await user.type(afterInput, "2026-08-01");

    // Assert that API calls include the filter params
    await waitFor(() => {
      expect(calls.some(url => url.includes("rag=RED"))).toBe(true);
    });
    await waitFor(() => {
      expect(calls.some(url => url.includes("countdown_after=2026-08-01"))).toBe(true);
    });
  });

  it("shows both first-run CTAs in the empty state for COMPLIANCE_OFFICER", async () => {
    mockApi([], "COMPLIANCE_OFFICER");
    await renderPage();
    await waitFor(() => expect(screen.getByText(/No shipments tracked yet/)).toBeInTheDocument());
    // "New consignment" renders twice (toolbar + empty-state CTA) — assert presence, not count.
    expect(screen.getAllByRole("button", { name: /New consignment/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Assign lots to a consignment/i })).toBeInTheDocument();
  });

  it("hides both first-run CTAs for VIEWER", async () => {
    mockApi([], "VIEWER");
    await renderPage();
    await waitFor(() => expect(screen.getByText(/No shipments tracked yet/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /New consignment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Assign lots to a consignment/i })).not.toBeInTheDocument();
  });

  it("redirects SUPPLIER_CONTACT to /dashboard without rendering the list", async () => {
    mockApi([row()], "SUPPLIER_CONTACT");
    await renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("BL-RED-1")).not.toBeInTheDocument();
  });
});
