import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { ActionQueueCard } from "@/components/dashboard/action-queue-card";
import type { BatchReadiness, ConsignmentRow, DueDiligenceStatement } from "@/lib/api/types";

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
    funnel: {
      unit: "KG",
      ordered_quantity: "500000.0000",
      allocated_quantity: "500000.0000",
      geolocated_quantity: "500000.0000",
      filed_quantity: "250000.0000",
      uncovered_quantity: "250000.0000",
    },
    lot_count: 2,
    next_deadline: "2026-07-20",
    ...overrides,
  };
}

function redConsignmentRow(overrides: Partial<ConsignmentRow> = {}): ConsignmentRow {
  return {
    id: "con-1",
    reference: "MSCU-884210",
    expected_clearance_date: "2026-07-27",
    tracking_number: null,
    t49_request_id: null,
    latest_eta: null,
    eta_source: "NONE",
    created_at: "2026-07-01T00:00:00Z",
    rag: "RED",
    covered_count: 3,
    total_count: 4,
    countdown_to: "2026-07-27",
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
  redRows = [] as ConsignmentRow[],
  readinessResults = [] as BatchReadiness[],
  ddsResults = [] as DueDiligenceStatement[],
  latestSubmissions = [] as { id: string; dds_id: string; status: string }[],
  submissionDetails = {} as Record<string, unknown>,
  redRowsNeverResolve = false,
  readinessStatus = 200,
}: {
  redRows?: ConsignmentRow[];
  readinessResults?: BatchReadiness[];
  ddsResults?: DueDiligenceStatement[];
  latestSubmissions?: { id: string; dds_id: string; status: string }[];
  submissionDetails?: Record<string, unknown>;
  /** Never resolves the RED consignments fetch — used to exercise the
   * card's loading skeleton, same technique as
   * `priority-alert-banner.test.tsx`'s own loading test. */
  redRowsNeverResolve?: boolean;
  /** Non-200 status for the readiness endpoint — used to exercise the
   * card's degrade-without-crashing behavior on a failed fetch. */
  readinessStatus?: number;
}) {
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/supply-chain/consignments/") && url.includes("rag=RED")) {
      if (redRowsNeverResolve) return new Promise(() => {});
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(redRows)), { status: 200 }));
    }
    if (url.includes("/supply-chain/batches/readiness/")) {
      return readinessStatus === 200
        ? Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse(readinessResults)), { status: 200 }))
        : Promise.resolve(new Response("Internal Server Error", { status: readinessStatus }));
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
    if (url.includes("/suppliers/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
}

describe("ActionQueueCard", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("orders rows land-soon -> rejected/blocked -> ready-to-file, badge count summing all three groups", async () => {
    mockApi({
      redRows: [redConsignmentRow()],
      readinessResults: [
        readinessRow({ id: "po-blocked", reference_number: "PO-BLOCKED", blocked: true, blockers: [{ code: "PLOTS_FAILED_VALIDATION", message: "Failed", count: 1 }] }),
        readinessRow({ id: "po-ready", reference_number: "PO-READY", stage: "READY" }),
      ],
    });
    renderWithProviders(<ActionQueueCard />);

    await waitFor(() => expect(screen.getByText("MSCU-884210")).toBeInTheDocument());
    const refs = screen.getAllByRole("link", { name: /^(MSCU-|PO-)/ }).map((el) => el.textContent);
    expect(refs).toEqual(["MSCU-884210", "PO-BLOCKED", "PO-READY"]);
    expect(screen.getByText("3")).toBeInTheDocument(); // badge count = 1 + 1 + 1
  });

  it("Cover now CTA routes to the consignment detail page", async () => {
    mockApi({ redRows: [redConsignmentRow()] });
    renderWithProviders(<ActionQueueCard />);
    await waitFor(() => expect(screen.getByRole("link", { name: /Cover now/i })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Cover now/i })).toHaveAttribute("href", "/shipments/con-1");
  });

  it("Remediate/Review/File DDS CTAs match today's hrefs exactly", async () => {
    mockApi({
      readinessResults: [
        readinessRow({ id: "po-b", reference_number: "PO-B", blocked: true, blockers: [{ code: "PLOTS_FAILED_VALIDATION", message: "x", count: 1 }] }),
        readinessRow({ id: "po-f", reference_number: "PO-F", stage: "READY" }),
      ],
      ddsResults: [ddsStatement()],
      latestSubmissions: [{ id: "sub-1", dds_id: "dds-1", status: "SUBMITTED" }],
      submissionDetails: {
        "sub-1": { id: "sub-1", dds_id: "dds-1", traces_status: "REJECTED", status: "SUBMITTED", error_message: "Rejected." },
      },
    });
    renderWithProviders(<ActionQueueCard />);

    await waitFor(() => expect(screen.getByRole("link", { name: /Remediate/i })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Remediate/i })).toHaveAttribute("href", "/submissions/dds-1");
    expect(screen.getByRole("link", { name: /Review/i })).toHaveAttribute("href", "/sourcing/po-b");
    expect(screen.getByRole("link", { name: /File DDS/i })).toHaveAttribute("href", "/sourcing/po-f");
  });

  it("shows the single quiet line when all three groups are empty", async () => {
    mockApi({});
    renderWithProviders(<ActionQueueCard />);
    await waitFor(() => expect(screen.getByText("Nothing needs action. You're caught up.")).toBeInTheDocument());
  });

  it("hides every row's CTA when showCta is false, without hiding the row content", async () => {
    mockApi({ redRows: [redConsignmentRow()] });
    renderWithProviders(<ActionQueueCard showCta={false} />);

    await waitFor(() => expect(screen.getByText("MSCU-884210")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /Cover now/i })).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Loading / error states — required coverage beyond the group-ordering
  // and CTA-wiring tests above. Same techniques as
  // `priority-alert-banner.test.tsx`: a never-resolving fetch to catch the
  // card mid-flight, and a 500 response to exercise the degrade-without-
  // crashing path (the card has no dedicated per-group error banner, same
  // as the pre-redesign NeedsFilingCard/NeedsRemediationCard it reuses
  // logic from — a failed group's rows simply fall back to `?? []` and
  // don't render, rather than surfacing a broken/partial list).
  // ---------------------------------------------------------------------

  it("renders a loading skeleton while data is in flight", async () => {
    mockApi({ redRowsNeverResolve: true });
    const { container } = renderWithProviders(<ActionQueueCard />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("degrades to the calm empty state without crashing when a request fails", async () => {
    mockApi({ readinessStatus: 500 });
    renderWithProviders(<ActionQueueCard />);
    await waitFor(() => expect(screen.getByText("Nothing needs action. You're caught up.")).toBeInTheDocument());
  });
});
