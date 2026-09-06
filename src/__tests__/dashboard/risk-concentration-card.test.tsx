import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { RiskConcentrationCard } from "@/components/dashboard/risk-concentration-card";
import type {
  BatchReadiness,
  CertificationExpiring,
  DueDiligenceStatement,
  Supplier,
} from "@/lib/api/types";

const originalFetch = globalThis.fetch;

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0141",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    product_id: "commodity-1",
    transaction_date: "2026-07-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: { unit: "KG", ordered_quantity: "1000.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "1000.0000" },
    lot_count: 1,
    next_deadline: null,
    ...overrides,
  };
}

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "sup-high",
    name: "Ivoire Cocoa",
    country_of_origin: "CI",
    kyc_status: "VERIFIED",
    risk_rating: "HIGH",
    external_id: "",
    managed_by_id: "u1",
    supplier_organization_id: null,
    kyc_verified_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function ddsStatement(overrides: Partial<DueDiligenceStatement> = {}): DueDiligenceStatement {
  return {
    id: "dds-1",
    reference_number: "DDS-2026-0001",
    traces_reference: "",
    status: "SUBMITTED",
    statement_type: "OPERATOR",
    activity_type: "IMPORT",
    batch_ids: [],
    risk_conclusion: null,
    conclusion_justification: "",
    operator_id: "op-1",
    created_by_id: "u1",
    reviewed_by_id: null,
    submitted_at: "2026-01-01T00:00:00Z",
    valid_until: null,
    archived_until: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function expiringCert(overrides: Partial<CertificationExpiring> = {}): CertificationExpiring {
  return {
    id: "cert-1",
    supplier_id: "sup-1",
    supplier_name: "Acme Farms",
    certification_type: "Rainforest Alliance",
    certificate_number: "RA-001",
    valid_until: "2026-08-15",
    ...overrides,
  };
}

function mockApi({
  readinessResults = [] as BatchReadiness[],
  highRiskSuppliers = [] as Supplier[],
  plotsFailingCount = 0,
  ddsResults = [] as DueDiligenceStatement[],
  highRiskStatus = 200,
  expiringCerts = [] as CertificationExpiring[],
  expiringCertsCount = undefined as number | undefined,
  expiringCertsStatus = 200,
}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }));
    }
    // Must precede the `/suppliers/` + risk_rating branch below — this URL is
    // also under /suppliers/ and would otherwise fall through to the 404.
    if (url.includes("/suppliers/certifications/")) {
      return expiringCertsStatus === 200
        ? Promise.resolve(
            new Response(
              JSON.stringify(mockPaginatedResponse(expiringCerts, expiringCertsCount ?? expiringCerts.length)),
              { status: 200 }
            )
          )
        : Promise.resolve(new Response("error", { status: 500 }));
    }
    if (url.includes("/suppliers/") && url.includes("risk_rating=HIGH")) {
      return highRiskStatus === 200
        ? Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(highRiskSuppliers)), { status: 200 }))
        : Promise.resolve(new Response("error", { status: 500 }));
    }
    if (url.includes("/geolocation/plots/") && url.includes("validation_status=FAILED")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([], plotsFailingCount)), { status: 200 }));
    }
    if (url.includes("/due-diligence/statements/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(ddsResults)), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("RiskConcentrationCard", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("computes high-risk supplier count and KG-normalised volume share", async () => {
    mockApi({
      readinessResults: [
        readinessRow({ id: "po-1", seller_id: "sup-high", funnel: { unit: "KG", ordered_quantity: "1000.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "1000.0000" } }),
        readinessRow({ id: "po-2", seller_id: "sup-std", funnel: { unit: "KG", ordered_quantity: "3000.0000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "3000.0000" } }),
      ],
      highRiskSuppliers: [supplier()],
    });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText(/1 supplier/)).toBeInTheDocument());
    expect(screen.getByText(/25% vol/)).toBeInTheDocument();
    expect(screen.getByText(/Côte d.Ivoire/)).toBeInTheDocument();
    // Filtered doorway (dashboard-redesign-phase1 filtering addendum, Task 8
    // amendment): the click-through opens `/suppliers` pre-filtered to HIGH.
    const highRiskRow = screen.getByText("Suppliers flagged high-risk").closest("a");
    expect(highRiskRow).toHaveAttribute("href", "/suppliers?risk_rating=HIGH");
  });

  it("matches the plots-failing count to the paginator's count field exactly", async () => {
    mockApi({ plotsFailingCount: 3 });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Plots failing validation")).toBeInTheDocument());
    const row = screen.getByText("Plots failing validation").closest("a");
    expect(row).toHaveTextContent("3");
    // Filtered doorway (dashboard-redesign-phase1 filtering addendum, Task 8
    // amendment): the click-through opens `/plots` pre-filtered to FAILED.
    expect(row).toHaveAttribute("href", "/plots?validation_status=FAILED");
  });

  it("counts SUBMITTED DDS expiring within 90 days from the already-fetched statements", async () => {
    // Dates are relative to the real clock on purpose. The component calls
    // `countDdsExpiringWithin90Days(statements)` without an injected `now`, so a
    // hardcoded `valid_until` would silently drift out of the 90-day window as
    // real-world time passes and turn this into a time bomb. Fake timers are the
    // usual answer but deadlock against React Query's `waitFor` polling, and this
    // suite has no fake-timer precedent — relative fixtures need neither.
    const isoDate = (offsetDays: number) =>
      new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
    mockApi({
      ddsResults: [
        ddsStatement({ status: "SUBMITTED", valid_until: isoDate(30) }), // inside the window
        ddsStatement({ status: "SUBMITTED", valid_until: isoDate(180) }), // outside it
      ],
    });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Filed DDS expiring < 90 days")).toBeInTheDocument());
    const row = screen.getByText("Filed DDS expiring < 90 days").closest("a");
    // Assert the rendered COUNT, not just the label: with one statement inside
    // the window and one outside, "1" fails for a broken filter, a stuck "—", and
    // a stuck loading state alike. Asserting only the label/href (as this test
    // originally did) passes for all three.
    expect(row).toHaveTextContent("1");
    // Filtered doorway (dashboard-redesign-phase1 filtering addendum, Task 8
    // amendment): the click-through opens `/submissions` pre-filtered to
    // SUBMITTED (soonest-`valid_until` ordering was evaluated and found
    // infeasible frontend-only — see Task 7.3 — so this is filter-only).
    expect(row).toHaveAttribute("href", "/submissions?status=SUBMITTED");
  });

  it("shows a muted dash for a failed metric without blanking the other rows", async () => {
    mockApi({ highRiskStatus: 500, plotsFailingCount: 2 });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Plots failing validation")).toBeInTheDocument());
    const highRiskRow = screen.getByText("Suppliers flagged high-risk").closest("a");
    expect(highRiskRow).toHaveTextContent("—");
    const plotsRow = screen.getByText("Plots failing validation").closest("a");
    expect(plotsRow).toHaveTextContent("2");
  });

  it("shows literal zero rows when everything is clean, not a collapsed empty state", async () => {
    mockApi({});
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Suppliers flagged high-risk")).toBeInTheDocument());
    expect(screen.queryByText(/caught up/i)).not.toBeInTheDocument();
    const plotsRow = screen.getByText("Plots failing validation").closest("a");
    expect(plotsRow).toHaveTextContent("0");
  });

  // ── Metric 4c: certifications expiring (eudr-app#139 feed + #148 filter) ──

  it("renders the certifications-expiring count with a supplier · type sub-label", async () => {
    mockApi({ expiringCerts: [expiringCert()] });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const row = screen.getByText("Certifications expiring < 30 days").closest("a");
    expect(row).toHaveTextContent("1");
    // The mockup's literal sub-label shape: "1 supplier · Rainforest Alliance".
    expect(row).toHaveTextContent("1 supplier · Rainforest Alliance");
  });

  it("links through to /suppliers pre-filtered by the same 30-day window it displays", async () => {
    mockApi({ expiringCerts: [expiringCert()] });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const row = screen.getByText("Certifications expiring < 30 days").closest("a");
    // The window in the href MUST match the window in the label — a row that
    // says "< 30 days" and lands on a 90-day list is a lie on a compliance
    // surface. Both derive from CERTS_EXPIRING_WINDOW_DAYS.
    expect(row).toHaveAttribute("href", "/suppliers?certifications_expiring=30");
  });

  it("takes the count from the paginator, not the returned rows", async () => {
    // The feed is fetched with page_size=100 for the sub-label; if an org ever
    // exceeds that, `count` is still the truth. Asserting rows.length here
    // would let a truncated page silently understate exposure.
    mockApi({ expiringCerts: [expiringCert()], expiringCertsCount: 7 });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const row = screen.getByText("Certifications expiring < 30 days").closest("a");
    expect(row).toHaveTextContent("7");
  });

  it("summarises multiple suppliers and certification types in the sub-label", async () => {
    mockApi({
      expiringCerts: [
        expiringCert({ id: "c1", supplier_id: "s1", certification_type: "Rainforest Alliance" }),
        expiringCert({ id: "c2", supplier_id: "s2", certification_type: "Fairtrade" }),
        // Same supplier as c1 — distinct suppliers, not row count.
        expiringCert({ id: "c3", supplier_id: "s1", certification_type: "Rainforest Alliance" }),
      ],
    });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const row = screen.getByText("Certifications expiring < 30 days").closest("a");
    expect(row).toHaveTextContent("3");
    expect(row).toHaveTextContent("2 suppliers · Rainforest Alliance, Fairtrade");
  });

  it("caps the certification types listed and counts the rest as overflow", async () => {
    // Guards the `+N more` branch of summariseExpiringCerts. Without this, that
    // branch is unreachable by the suite: every other fixture stays at or under
    // MAX_CERT_TYPES_SHOWN, so deleting the overflow suffix entirely still
    // passed all 11 tests (found in review of PR #86).
    mockApi({
      expiringCerts: [
        expiringCert({ id: "c1", supplier_id: "s1", certification_type: "Rainforest Alliance" }),
        expiringCert({ id: "c2", supplier_id: "s2", certification_type: "Fairtrade" }),
        expiringCert({ id: "c3", supplier_id: "s3", certification_type: "Organic" }),
        expiringCert({ id: "c4", supplier_id: "s4", certification_type: "UTZ" }),
      ],
    });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const row = screen.getByText("Certifications expiring < 30 days").closest("a");
    expect(row).toHaveTextContent("4 suppliers · Rainforest Alliance, Fairtrade +2 more");
  });

  it("does not add an overflow suffix when the types fit exactly", async () => {
    // The off-by-one companion to the test above: at exactly
    // MAX_CERT_TYPES_SHOWN the label must read clean, with no "+0 more".
    mockApi({
      expiringCerts: [
        expiringCert({ id: "c1", supplier_id: "s1", certification_type: "Rainforest Alliance" }),
        expiringCert({ id: "c2", supplier_id: "s2", certification_type: "Fairtrade" }),
      ],
    });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const row = screen.getByText("Certifications expiring < 30 days").closest("a");
    expect(row).toHaveTextContent("2 suppliers · Rainforest Alliance, Fairtrade");
    expect(row).not.toHaveTextContent("more");
  });

  it("degrades the certifications row to a dash without blanking its neighbours", async () => {
    mockApi({ expiringCertsStatus: 500, plotsFailingCount: 2 });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const certsRow = screen.getByText("Certifications expiring < 30 days").closest("a");
    expect(certsRow).toHaveTextContent("—");
    const plotsRow = screen.getByText("Plots failing validation").closest("a");
    expect(plotsRow).toHaveTextContent("2");
  });

  it("shows a literal zero for certifications when none are expiring", async () => {
    mockApi({ expiringCerts: [] });
    renderWithProviders(<RiskConcentrationCard />);
    await waitFor(() => expect(screen.getByText("Certifications expiring < 30 days")).toBeInTheDocument());
    const row = screen.getByText("Certifications expiring < 30 days").closest("a");
    expect(row).toHaveTextContent("0");
    expect(row).toHaveTextContent("None expiring");
  });
});
