/**
 * QA regression test — PO Detail (eudr-frontend #29 / PR #48) equivalent of
 * the pattern adopted for the Supplier Detail branch's QA finding on PR #47
 * (`src/__tests__/pages/supplier-detail-security.test.tsx`).
 *
 * PR #48 (commit e6fcc65) wraps all three of this page's fetch
 * interpolations — the route `id`, and the readiness response's
 * `seller_id`/`commodity_id` — with `encodeURIComponent`. This test proves
 * that fix holds for an adversarial value rather than taking the PR
 * description's word for it.
 *
 * All three ids are interpolated as PATH segments here (not query-string
 * values, unlike the Supplier Detail page's `seller_id` filter), so the
 * sharpest adversarial case is an id containing a literal `?` and `&`: if
 * unescaped, `?` starts a query string mid-path (corrupting the intended
 * `.../readiness/` path so the request silently 404s or hits the wrong
 * route) and the trailing `&page_size=...` fragment rides along as a real,
 * attacker-controlled query parameter. A correctly `encodeURIComponent`-ed
 * id keeps the whole value as one opaque, percent-encoded path segment and
 * the real path suffix (`/readiness/`, trailing slash) intact.
 *
 * Expected on this branch (post e6fcc65): PASSES.
 */
import { Suspense, act } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import PoDetailPage from "@/app/(dashboard)/supply-chains/[id]/page";
import type { POReadinessDetail, Product, Supplier } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

// An id that smuggles a `?` (would start a query string mid-path if
// unescaped) and a `&`-delimited extra param.
const MALICIOUS_ID = "po-1?foo=bar&page_size=999999";

const SUPPLIER: Supplier = {
  id: MALICIOUS_ID,
  name: "Kuapa Kokoo Union",
  country_of_origin: "GH",
  kyc_status: "VERIFIED",
  risk_rating: "STANDARD",
  external_id: "",
  managed_by_id: "u1",
  supplier_organization_id: null,
  kyc_verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PRODUCT: Product = {
  id: MALICIOUS_ID,
  commodity: "commodity-1",
  commodity_name: "Cocoa",
  species: null,
  description: "Fermented cocoa beans",
  internal_product_code: "COCOA-01",
  cn_code: "1801",
  is_active: true,
};

function readinessDetail(): POReadinessDetail {
  return {
    id: MALICIOUS_ID,
    reference_number: "PO-2026-0141",
    seller_id: MALICIOUS_ID,
    buyer_id: "buyer-1",
    commodity_id: MALICIOUS_ID,
    transaction_date: "2026-07-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "500000.0000",
      allocated_quantity: "300000.0000",
      geolocated_quantity: "280000.0000",
      filed_quantity: "250000.0000",
      uncovered_quantity: "250000.0000",
    },
    lot_count: 0,
    next_deadline: null,
    lots: [],
  };
}

async function renderPage(calledUrls: string[]) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calledUrls.push(url);
    if (url.includes("/supply-chain/batches/") && url.includes("/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(readinessDetail()), { status: 200 }));
    }
    if (url.includes("/suppliers/")) {
      return Promise.resolve(new Response(JSON.stringify(SUPPLIER), { status: 200 }));
    }
    if (url.includes("/commodities/products/")) {
      return Promise.resolve(new Response(JSON.stringify(PRODUCT), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;

  await act(async () => {
    renderWithProviders(
      <Suspense fallback={null}>
        <PoDetailPage params={Promise.resolve({ id: MALICIOUS_ID })} />
      </Suspense>
    );
  });
}

describe("PoDetailPage — route/response id escaping (security)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("keeps an unescaped '?'/'&'-bearing route id as one opaque path segment on the readiness fetch", async () => {
    const calledUrls: string[] = [];
    await renderPage(calledUrls);

    await waitFor(() =>
      expect(calledUrls.some((u) => u.includes("/supply-chain/batches/"))).toBe(true)
    );
    const readinessUrl = calledUrls.find((u) => u.includes("/supply-chain/batches/"))!;

    // A correctly escaped id keeps the real path suffix intact and produces
    // no query string at all on this request.
    expect(readinessUrl).toContain(encodeURIComponent(MALICIOUS_ID));
    expect(readinessUrl.endsWith("/readiness/")).toBe(true);
    const parsed = new URL(readinessUrl, "http://localhost");
    expect(parsed.search).toBe("");
    expect(parsed.pathname.endsWith("/readiness/")).toBe(true);
  });

  it("keeps the readiness response's seller_id as one opaque path segment on the supplier fetch", async () => {
    const calledUrls: string[] = [];
    await renderPage(calledUrls);

    await waitFor(() => expect(calledUrls.some((u) => u.includes("/suppliers/"))).toBe(true));
    const supplierUrl = calledUrls.find((u) => u.includes("/suppliers/"))!;

    expect(supplierUrl).toContain(encodeURIComponent(MALICIOUS_ID));
    const parsed = new URL(supplierUrl, "http://localhost");
    expect(parsed.search).toBe("");
  });

  it("keeps the readiness response's commodity_id as one opaque path segment on the product fetch", async () => {
    const calledUrls: string[] = [];
    await renderPage(calledUrls);

    await waitFor(() =>
      expect(calledUrls.some((u) => u.includes("/commodities/products/"))).toBe(true)
    );
    const productUrl = calledUrls.find((u) => u.includes("/commodities/products/"))!;

    expect(productUrl).toContain(encodeURIComponent(MALICIOUS_ID));
    const parsed = new URL(productUrl, "http://localhost");
    expect(parsed.search).toBe("");
  });
});
