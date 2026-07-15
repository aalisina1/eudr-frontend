/**
 * QA regression test — proves the security-review finding posted on
 * eudr-frontend PR #47 (`suppliers/[id]/page.tsx` interpolates the raw route
 * `id` into fetch URLs without `encodeURIComponent`) is real and, as of this
 * branch, UNFIXED.
 *
 * This test is intentionally adversarial: it supplies a route `id` that
 * itself contains a `&`-delimited query param (`page_size=999999`). If the
 * `id` were properly escaped, the resulting request URL would contain the
 * literal, percent-encoded id as a single opaque `seller_id` value. Because
 * it is NOT escaped on this branch, the attacker-supplied `page_size`
 * fragment rides along as a second, real query parameter on the request —
 * i.e. a same-origin, same-session query-parameter injection into the
 * user's own API call.
 *
 * Expected on this branch: FAILS (proving the bug).
 * Expected once `encodeURIComponent(id)` is applied in both fetches in
 * `suppliers/[id]/page.tsx`: PASSES.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { Suspense } from "react";
import { waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import SupplierDetailPage from "@/app/(dashboard)/suppliers/[id]/page";
import type { Supplier } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

// A route id that smuggles a second query param via an unescaped `&`.
const MALICIOUS_ID = "sup-1&page_size=999999";

const SUPPLIER: Supplier = {
  id: MALICIOUS_ID,
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
  certifications: [],
};

function resolvedParams(id: string) {
  const p = Promise.resolve({ id }) as Promise<{ id: string }> & { status?: string; value?: unknown };
  p.status = "fulfilled";
  p.value = { id };
  return p;
}

describe("SupplierDetailPage — route id escaping (security)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("does not let an unescaped route id inject extra query params into the readiness fetch", async () => {
    const calledUrls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calledUrls.push(url);
      if (url.includes("/supply-chain/batches/readiness/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 })
        );
      }
      if (url.includes(`/suppliers/${encodeURIComponent(MALICIOUS_ID)}/`) || url.includes(`/suppliers/${MALICIOUS_ID}/`)) {
        return Promise.resolve(new Response(JSON.stringify(SUPPLIER), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
    }) as typeof fetch;

    renderWithProviders(
      <Suspense fallback={<div />}>
        <SupplierDetailPage params={resolvedParams(MALICIOUS_ID)} />
      </Suspense>
    );

    await waitFor(() =>
      expect(calledUrls.some((u) => u.includes("/supply-chain/batches/readiness/"))).toBe(true)
    );

    const readinessUrl = calledUrls.find((u) => u.includes("/supply-chain/batches/readiness/"))!;

    // The attacker-controlled `page_size=999999` fragment must NOT appear as
    // its own query param — it should only ever appear as part of the
    // percent-encoded seller_id value.
    const parsed = new URL(readinessUrl, "http://localhost");
    expect(parsed.searchParams.getAll("page_size")).toEqual(["100"]); // only the app's own page_size=100
    expect(parsed.searchParams.get("seller_id")).toBe(MALICIOUS_ID); // decoded back to the full literal id
  });

  it("does not let an unescaped route id inject extra query params into the supplier fetch", async () => {
    const calledUrls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calledUrls.push(url);
      if (url.includes("/supply-chain/batches/readiness/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 })
        );
      }
      return Promise.resolve(new Response(JSON.stringify(SUPPLIER), { status: 200 }));
    }) as typeof fetch;

    renderWithProviders(
      <Suspense fallback={<div />}>
        <SupplierDetailPage params={resolvedParams(MALICIOUS_ID)} />
      </Suspense>
    );

    await waitFor(() => expect(calledUrls.length).toBeGreaterThan(0));

    const supplierUrl = calledUrls.find((u) => u.includes("/suppliers/") && !u.includes("readiness"))!;
    expect(supplierUrl).toBeDefined();
    // A correctly-escaped id would produce exactly one path segment; an
    // unescaped id containing `&` still parses as one path segment here
    // (no `?` involved), but must not be usable to smuggle a query string
    // onto this same request if a caller ever appends one. Assert the raw
    // id was passed through `encodeURIComponent` (i.e. `&` -> `%26`).
    expect(supplierUrl).toContain(encodeURIComponent(MALICIOUS_ID));
  });
});
