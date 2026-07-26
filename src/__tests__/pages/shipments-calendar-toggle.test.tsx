import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import ShipmentsPage from "@/app/(dashboard)/shipments/page";
import type { ConsignmentRow, User } from "@/lib/api/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/shipments",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams("view=calendar"),
  redirect: vi.fn(),
}));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); vi.clearAllMocks(); });

const IN_3_DAYS = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

function mockApi(agenda: ConsignmentRow[], role: User["role"] = "COMPLIANCE_OFFICER") {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/auth/users/me/"))
      return Promise.resolve(new Response(JSON.stringify({ id: "u1", role }), { status: 200 }));
    if (url.includes("/consignments/agenda/"))
      return Promise.resolve(new Response(JSON.stringify(agenda), { status: 200 }));
    return Promise.resolve(new Response("[]", { status: 200 }));
  }) as typeof fetch;
}

function agendaRow(): ConsignmentRow {
  return {
    id: "c1", reference: "BL-CAL", expected_clearance_date: IN_3_DAYS,
    customs_declaration_reference: "", tracking_number: null,
    t49_request_id: null, latest_eta: null, eta_source: "NONE", created_at: "2026-07-20T00:00:00Z",
    rag: "RED", covered_count: 0, total_count: 2, countdown_to: IN_3_DAYS,
  };
}

describe("/shipments Calendar view", () => {
  it("renders the agenda (not the list) when ?view=calendar", async () => {
    mockApi([agendaRow()]);
    await act(async () => { renderWithProviders(<ShipmentsPage />); });
    await waitFor(() => expect(screen.getByText("BL-CAL")).toBeInTheDocument());
    expect(screen.getByText("This week")).toBeInTheDocument();
  });

  it("hides the List view's date-range inputs in Calendar view", async () => {
    mockApi([agendaRow()]);
    await act(async () => { renderWithProviders(<ShipmentsPage />); });
    await waitFor(() => expect(screen.getByText("BL-CAL")).toBeInTheDocument());
    expect(screen.queryByLabelText(/Lands after/i)).toBeNull();
    expect(screen.queryByLabelText(/Lands before/i)).toBeNull();
  });
});
