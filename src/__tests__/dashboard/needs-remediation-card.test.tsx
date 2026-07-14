import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { NeedsRemediationCard } from "@/components/dashboard/needs-remediation-card";
import type { BatchReadiness, DueDiligenceStatement } from "@/lib/api/types";

const originalFetch = globalThis.fetch;

function readinessRow(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0138",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    commodity_id: "commodity-1",
    transaction_date: "2026-07-01",
    stage: "ALLOCATED",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "500000.0000",
      allocated_quantity: "300000.0000",
      geolocated_quantity: "280000.0000",
      filed_quantity: "0.0000",
      uncovered_quantity: "500000.0000",
    },
    lot_count: 2,
    next_deadline: null,
    ...overrides,
  };
}

function ddsStatement(overrides: Partial<DueDiligenceStatement> = {}): DueDiligenceStatement {
  return {
    id: "dds-1",
    reference_number: "DDS-2026-0089",
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
    submitted_at: new Date().toISOString(),
    valid_until: null,
    archived_until: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockApi({
  readinessResults = [] as BatchReadiness[],
  ddsResults = [] as DueDiligenceStatement[],
  latestSubmissions = [] as { id: string; dds_id: string; status: string }[],
  submissionDetails = {} as Record<string, unknown>,
}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/batches/readiness/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }));
    }
    if (url.includes("/due-diligence/statements/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(ddsResults)), { status: 200 }));
    }
    if (/\/traces\/submissions\/[^/?]+\/?$/.test(url)) {
      const id = url.match(/\/traces\/submissions\/([^/?]+)\/?/)?.[1] ?? "";
      return Promise.resolve(new Response(JSON.stringify(submissionDetails[id] ?? {}), { status: 200 }));
    }
    if (url.includes("/traces/submissions/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(latestSubmissions)), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("NeedsRemediationCard", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders a BLOCKED PO with a destructive badge, blocker reason, and a Review deep-link to the PO", async () => {
    mockApi({
      readinessResults: [
        readinessRow({
          blocked: true,
          blockers: [
            { code: "PLOTS_FAILED_VALIDATION", message: "3 plots failed deforestation validation", count: 3 },
          ],
        }),
      ],
    });
    renderWithProviders(<NeedsRemediationCard />);

    await waitFor(() => expect(screen.getByText("PO-2026-0138")).toBeInTheDocument());
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("3 plots failed deforestation validation")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Review/i });
    expect(link).toHaveAttribute("href", "/supply-chains/po-1");
  });

  it("renders a rejected DDS with a destructive badge, the TRACES reason, and a Remediate deep-link to the DDS", async () => {
    mockApi({
      ddsResults: [ddsStatement()],
      latestSubmissions: [{ id: "sub-1", dds_id: "dds-1", status: "SUBMITTED" }],
      submissionDetails: {
        "sub-1": {
          id: "sub-1",
          dds_id: "dds-1",
          traces_status: "REJECTED",
          status: "SUBMITTED",
          error_message: "Geolocation error on 3 plots.",
        },
      },
    });
    renderWithProviders(<NeedsRemediationCard />);

    await waitFor(() => expect(screen.getByText("DDS-2026-0089")).toBeInTheDocument());
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Geolocation error on 3 plots.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Remediate/i });
    expect(link).toHaveAttribute("href", "/due-diligence/dds-1");
  });

  it("shows the quiet empty state when nothing is rejected or blocked", async () => {
    mockApi({});
    renderWithProviders(<NeedsRemediationCard />);
    await waitFor(() =>
      expect(screen.getByText("Nothing rejected or blocked — no remediation open")).toBeInTheDocument()
    );
  });
});
