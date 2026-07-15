import { describe, it, expect, vi, afterEach } from "vitest";
import { Suspense } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import SupplierDetailPage from "@/app/(dashboard)/suppliers/[id]/page";
import type { BatchReadiness, Supplier } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

const SUPPLIER: Supplier = {
  id: "sup-1",
  name: "Kuapa Kokoo Union",
  country_of_origin: "GH",
  kyc_status: "VERIFIED",
  risk_rating: "STANDARD",
  external_id: "EXT-1",
  managed_by_id: "u1",
  supplier_organization_id: null,
  kyc_verified_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  certifications: [
    {
      id: "cert-1",
      certification_type: "Rainforest Alliance",
      certificate_number: "RA-001",
      issuing_body: "RA",
      valid_from: "2025-01-01",
      valid_until: "2027-01-01",
      document_id: null,
      is_valid: true,
      created_at: "2025-01-01T00:00:00Z",
    },
  ],
};

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0119",
    seller_id: SUPPLIER.id,
    buyer_id: "buyer-1",
    commodity_id: "prod-1",
    transaction_date: "2026-06-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "75000.0000",
      allocated_quantity: "75000.0000",
      geolocated_quantity: "75000.0000",
      filed_quantity: "0",
      uncovered_quantity: "75000",
    },
    lot_count: 2,
    next_deadline: null,
    ...overrides,
  };
}

function mockApi({
  readinessResults = [readinessRow()],
  readinessOk = true,
}: { readinessResults?: BatchReadiness[]; readinessOk?: boolean } = {}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/")) {
      if (!readinessOk) {
        return Promise.resolve(new Response(JSON.stringify({ detail: "error" }), { status: 500 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 })
      );
    }
    if (url.includes("/suppliers/sup-1/")) {
      return Promise.resolve(new Response(JSON.stringify(SUPPLIER), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

/** Pre-resolve the `params` thenable using React's own "fulfilled thenable"
 * fast path (`ReactFiberThenable.trackUsedThenable` reads `.status`/`.value`
 * off *any* passed-in thenable before deciding whether to suspend) — the
 * App Router's `use(params)` convention otherwise suspends on the first
 * render and relies on a Suspense retry once the promise settles, which
 * doesn't reliably flush in this jsdom/Vitest harness (verified in
 * isolation: a bare `use()` + Suspense repro hangs indefinitely here too,
 * unrelated to this page). This is the documented, non-hacky way to hand
 * `use()` an already-resolved value without going through Suspense at all. */
function resolvedParams(id: string) {
  const p = Promise.resolve({ id }) as Promise<{ id: string }> & { status?: string; value?: unknown };
  p.status = "fulfilled";
  p.value = { id };
  return p;
}

function renderPage() {
  return renderWithProviders(
    <Suspense fallback={<div data-testid="page-suspense-fallback" />}>
      <SupplierDetailPage params={resolvedParams("sup-1")} />
    </Suspense>
  );
}

describe("SupplierDetailPage", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders the loading skeleton before data resolves", async () => {
    // Never resolves within the test — proves the Skeleton is what's on
    // screen, not a fast-resolving mock racing past it.
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0));
  });

  it("renders a not-found state when the supplier fetch fails, without crashing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "nope" }), { status: 404 }));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Supplier not found or failed to load/)).toBeInTheDocument());
  });

  it("fetches the readiness list filtered by this supplier's seller_id", async () => {
    mockApi();
    renderPage();
    await waitFor(() => expect(screen.getByText("Sourcing from this supplier")).toBeInTheDocument());

    const calledUrls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("/supply-chain/batches/readiness/") && u.includes(`seller_id=${SUPPLIER.id}`))).toBe(true);
  });

  it("renders the Sourcing card populated with this supplier's PO", async () => {
    mockApi();
    renderPage();
    await waitFor(() => expect(screen.getByText("PO-2026-0119")).toBeInTheDocument());
  });

  it("renders the Data gaps card", async () => {
    mockApi({
      readinessResults: [
        readinessRow({ blockers: [{ code: "MISSING_HARVEST_PERIOD", message: "1 lot missing harvest period", count: 1 }] }),
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Data gaps")).toBeInTheDocument());
    expect(screen.getByText("1 lot missing harvest period")).toBeInTheDocument();
  });

  it("keeps the Sourcing card resilient to a readiness-fetch failure (rest of the page still renders)", async () => {
    mockApi({ readinessOk: false });
    renderPage();
    await waitFor(() => expect(screen.getByText("Sourcing from this supplier")).toBeInTheDocument());
    expect(screen.getByText(/Failed to load this supplier's sourcing data/i)).toBeInTheDocument();
    // KYC/certifications still render even though the readiness fetch failed.
    expect(screen.getByText("Kuapa Kokoo Union")).toBeInTheDocument();
    expect(screen.getByText("Certifications")).toBeInTheDocument();
  });

  it("renders Certifications below Sourcing from this supplier (Prompt E reorder)", async () => {
    mockApi();
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText("Sourcing from this supplier")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Certifications")).toBeInTheDocument());

    const headings = Array.from(container.querySelectorAll('[data-slot="card-title"], h2')).map((el) => el.textContent);
    const sourcingIdx = headings.findIndex((h) => h === "Sourcing from this supplier");
    const certsIdx = headings.findIndex((h) => h?.includes("Certifications"));
    expect(sourcingIdx).toBeGreaterThanOrEqual(0);
    expect(certsIdx).toBeGreaterThan(sourcingIdx);
  });

  it("still renders KYC/risk badges and the certifications table", async () => {
    mockApi();
    renderPage();
    await waitFor(() => expect(screen.getByText("Kuapa Kokoo Union")).toBeInTheDocument());
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Rainforest Alliance")).toBeInTheDocument();
  });
});
