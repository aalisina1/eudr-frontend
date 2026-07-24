import { afterEach, describe, expect, it, vi } from "vitest";
import { Suspense, act } from "react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import ShipmentDetailPage from "@/app/(dashboard)/shipments/[id]/page";
import type { ConsignmentDetail, User } from "@/lib/api/types";

// setup.ts's next/navigation mock builds FRESH plain functions per
// useRouter() call — `vi.mocked(useRouter).mockReturnValue(...)` would throw
// (it's not a vi.fn) and per-render routers can't be asserted from outside.
// House pattern: re-mock at file level with module-scoped spies (see
// file-dds-composer-routing.test.tsx).
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/shipments/c1",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.clearAllMocks(); });

function detail(over: Partial<ConsignmentDetail> = {}): ConsignmentDetail {
  return {
    id: "c1", reference: "BL-RED-1", expected_clearance_date: "2026-07-25",
    tracking_number: "MSCU1", t49_request_id: "treq_1", latest_eta: "2026-08-10T00:00:00Z",
    eta_source: "FEED", created_at: "2026-07-20T00:00:00Z", rag: "RED", covered_count: 0,
    total_count: 1, countdown_to: "2026-07-25",
    lots: [{ id: "l1", reference_number: "LOT-1", quantity: "1000.0000", unit: "KG", stage: "ALLOCATED", covered: false, covering_dds_id: null, covering_dds_reference: "" }],
    events: [{ event_type: "eta_changed", occurred_at: "2026-07-21T09:00:00Z" }],
    ...over,
  };
}

function mockApi(d: ConsignmentDetail, role: User["role"] = "COMPLIANCE_OFFICER") {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/auth/users/me/"))
      return Promise.resolve(new Response(JSON.stringify({ id: "u1", role } as Partial<User>), { status: 200 }));
    if (url.includes(`/supply-chain/consignments/${d.id}/`))
      return Promise.resolve(new Response(JSON.stringify(d), { status: 200 }));
    return Promise.resolve(new Response("{}", { status: 404 }));
  }) as typeof fetch;
}

async function renderPage(id = "c1") {
  let r!: ReturnType<typeof renderWithProviders>;
  await act(async () => {
    r = renderWithProviders(
      <Suspense fallback={null}><ShipmentDetailPage params={Promise.resolve({ id })} /></Suspense>
    );
  });
  return r;
}

describe("/shipments/[id] detail", () => {
  it("renders header, coverage, a lot, and the milestone timeline", async () => {
    mockApi(detail());
    await renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: "BL-RED-1" })).toBeInTheDocument());
    expect(screen.getByText(/0\/1/)).toBeInTheDocument();
    expect(screen.getByText("LOT-1")).toBeInTheDocument();
    expect(screen.getByText(/eta_changed/)).toBeInTheDocument();
  });

  it("shows the divergence badge when clearance date and feed ETA disagree", async () => {
    mockApi(detail());
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Date ≠ ETA/i)).toBeInTheDocument());
  });

  it("navigates to the composer with ?consignment= on Compose DDS", async () => {
    mockApi(detail());
    await renderPage();
    const btn = await screen.findByRole("button", { name: /Compose DDS/i });
    await act(async () => { await userEvent.click(btn); });
    expect(push).toHaveBeenCalledWith("/due-diligence?consignment=c1");
  });

  it("hides all mutation controls for VIEWER", async () => {
    mockApi(detail(), "VIEWER");
    await renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: "BL-RED-1" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Compose DDS/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Assign lots/i })).not.toBeInTheDocument();
  });

  it("renders the standard 404 for a missing/cross-org consignment", async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/auth/users/me/")) return Promise.resolve(new Response(JSON.stringify({ role: "COMPLIANCE_OFFICER" }), { status: 200 }));
      return Promise.resolve(new Response("{}", { status: 404 }));
    }) as typeof fetch;
    await renderPage("missing");
    await waitFor(() => expect(screen.getByText(/not found or failed to load/i)).toBeInTheDocument());
  });
});
