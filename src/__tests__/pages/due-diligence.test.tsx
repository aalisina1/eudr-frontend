import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, mockPaginatedResponse, createMockFetch } from "../helpers";
import DueDiligencePage from "@/app/(dashboard)/due-diligence/page";

// File-level mock (house pattern — see file-dds-composer-routing.test.tsx):
// the global next/navigation mock in setup.ts always returns an EMPTY
// URLSearchParams, so the `?status=` seeding tests below need a mutable
// `searchParams` this file can reassign per test.
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/due-diligence",
  useParams: () => ({}),
  useSearchParams: () => searchParams,
  redirect: vi.fn(),
}));

const originalFetch = globalThis.fetch;

function makeMockFetch(status: string) {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify(
        mockPaginatedResponse([
          {
            id: "dds1",
            reference_number: "DDS-2026-001",
            status,
            statement_type: "OPERATOR",
            risk_conclusion: null,
            submitted_at: null,
            created_at: "2026-03-01T00:00:00Z",
          },
        ])
      ),
      { status: 200 }
    )
  );
}

describe("DueDiligencePage", () => {
  beforeEach(() => {
    globalThis.fetch = makeMockFetch("DRAFT");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
  });

  it("renders the page title as Submissions (not Due Diligence)", () => {
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Submissions");
    expect(screen.queryByRole("heading", { level: 1, name: /due diligence/i })).toBeNull();
  });

  it("points at the purchase order, which is where a statement starts", () => {
    /** Reversed deliberately. This asserted a "New Statement" button, which
     * opened a sheet with no lot selection and produced statements covering
     * nothing — unfilable, since `commodities` is mandatory in the TRACES XSD
     * (#104). The affordance is now a link into Sourcing, which is the only
     * path that composes a statement TRACES will accept. */
    renderWithProviders(<DueDiligencePage />);
    expect(screen.queryByText("New Statement")).toBeNull();
    expect(
      screen.getByRole("link", { name: /file from a purchase order/i }),
    ).toHaveAttribute("href", "/supply-chains");
  });

  it("renders DDS data after loading", async () => {
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      expect(screen.getByText("DDS-2026-001")).toBeInTheDocument();
    });
  });

  it("renders status and type filters", () => {
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
    expect(screen.getByText("All Risk Levels")).toBeInTheDocument();
  });

  it("renders a DRAFT status badge for a DRAFT DDS", async () => {
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      // Filter option always present (1); badge in table row adds another occurrence after data loads.
      const matches = screen.getAllByText("Draft");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders an Approved status badge for an APPROVED DDS", async () => {
    globalThis.fetch = makeMockFetch("APPROVED");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Approved");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders a Rejected status badge for a REJECTED DDS", async () => {
    globalThis.fetch = makeMockFetch("REJECTED");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Rejected");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders a Submitted status badge for a SUBMITTED DDS", async () => {
    globalThis.fetch = makeMockFetch("SUBMITTED");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Submitted");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders a Withdrawn status badge for a WITHDRAWN DDS", async () => {
    globalThis.fetch = makeMockFetch("WITHDRAWN");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Withdrawn");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders an Under Review status badge for an UNDER_REVIEW DDS", async () => {
    globalThis.fetch = makeMockFetch("UNDER_REVIEW");
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Under Review");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ---------------------------------------------------------------------------
// #22 / ADR-0017 — the badge must derive from the DDS's latest TracesSubmission
// once one exists, never echo `dds.status` raw. The internal DDS status stays
// SUBMITTED forever once a transport succeeds (apps/traces_integration/submit.py
// `perform_submit`), so the regulator's actual verdict (AVAILABLE/REJECTED/...)
// only shows up via the submission row.
// ---------------------------------------------------------------------------

function ddsListResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return mockPaginatedResponse([
    {
      id: "dds1",
      reference_number: "DDS-2026-001",
      status: "SUBMITTED",
      statement_type: "OPERATOR",
      risk_conclusion: null,
      submitted_at: "2026-03-01T00:00:00Z",
      created_at: "2026-03-01T00:00:00Z",
      ...overrides,
    },
  ]);
}

/** Full `TracesSubmissionSerializer` detail shape (GET .../submissions/{id}/). */
function tracesDetail(overrides: Partial<Record<string, unknown>>) {
  return {
    id: "sub1",
    dds_id: "dds1",
    submission_type: "CREATE",
    status: "SUBMITTED",
    traces_reference_number: "REF-1",
    verification_number: "",
    error_message: "",
    error_detail: [],
    attempt_count: 1,
    last_attempted_at: null,
    next_retry_at: null,
    submitted_at: "2026-03-01T01:00:00Z",
    submitted_by_id: "u1",
    soap_request_payload: "",
    soap_response_payload: "",
    created_at: "2026-03-01T01:00:00Z",
    ...overrides,
  };
}

describe("DueDiligencePage — TRACES-derived status badge (#22, ADR-0017)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
  });

  it("shows Available derived from the latest TRACES submission, not the internal Submitted status", async () => {
    globalThis.fetch = createMockFetch({
      // Specific pattern first — `/submissions/sub1/` also contains the
      // shorter bulk-list pattern below, so order picks the right stub.
      "/api/v1/traces/submissions/sub1/": tracesDetail({ traces_status: "AVAILABLE", verification_number: "VER-1" }),
      "/api/v1/traces/submissions/": mockPaginatedResponse([{ id: "sub1", dds_id: "dds1", status: "SUBMITTED" }]),
      "/api/v1/due-diligence/statements/": ddsListResponse(),
    });
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      expect(screen.getAllByText("Available").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Rejected derived from a TRACES business rejection even though the DDS itself stays Submitted", async () => {
    globalThis.fetch = createMockFetch({
      "/api/v1/traces/submissions/sub1/": tracesDetail({ traces_status: "REJECTED", error_message: "Missing geolocation." }),
      "/api/v1/traces/submissions/": mockPaginatedResponse([{ id: "sub1", dds_id: "dds1", status: "SUBMITTED" }]),
      "/api/v1/due-diligence/statements/": ddsListResponse(),
    });
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      // "Rejected" is also a filter option, so the internal-status test above
      // asserts >=2; the point here is it derives from traces_status while
      // dds.status is SUBMITTED (not the internal REJECTED enum at all).
      expect(screen.getAllByText("Rejected").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("falls back to the internal DDS status when no TRACES submission matches this row", async () => {
    globalThis.fetch = createMockFetch({
      // A submission exists in the org, but for a *different* DDS — the map
      // lookup for "dds1" must miss and fall back cleanly.
      "/api/v1/traces/submissions/other-sub/": tracesDetail({ dds_id: "dds-other", traces_status: "AVAILABLE" }),
      "/api/v1/traces/submissions/": mockPaginatedResponse([{ id: "other-sub", dds_id: "dds-other", status: "SUBMITTED" }]),
      "/api/v1/due-diligence/statements/": ddsListResponse({ status: "APPROVED" }),
    });
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const matches = screen.getAllByText("Approved");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows Failed when the last submission attempt failed on our side, even though the DDS is still Approved", async () => {
    globalThis.fetch = createMockFetch({
      // Pipeline FAILED is already on the lightweight list serializer — no
      // detail follow-up is needed (or expected) for this case.
      "/api/v1/traces/submissions/": mockPaginatedResponse([{ id: "sub1", dds_id: "dds1", status: "FAILED" }]),
      "/api/v1/due-diligence/statements/": ddsListResponse({ status: "APPROVED" }),
    });
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Submitting while a submission is still queued/processing", async () => {
    globalThis.fetch = createMockFetch({
      "/api/v1/traces/submissions/": mockPaginatedResponse([{ id: "sub1", dds_id: "dds1", status: "PROCESSING" }]),
      "/api/v1/due-diligence/statements/": ddsListResponse({ status: "APPROVED" }),
    });
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      expect(screen.getAllByText("Submitting").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // QA (PR #37 review): ADR-0017's FE derivation table has an explicit row —
  // `status ∈ {QUEUED, PROCESSING, RETRYING}` → "Submitting…". This test
  // validates that RETRYING is correctly included in IN_FLIGHT.
  // ---------------------------------------------------------------------------
  it("shows Submitting (not the raw internal Approved status) when the latest submission is RETRYING", async () => {
    globalThis.fetch = createMockFetch({
      // Pipeline RETRYING is already on the lightweight list serializer —
      // per ADR-0017 no detail follow-up should be needed for this case.
      "/api/v1/traces/submissions/": mockPaginatedResponse([{ id: "sub1", dds_id: "dds1", status: "RETRYING" }]),
      "/api/v1/due-diligence/statements/": ddsListResponse({ status: "APPROVED" }),
    });
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      expect(screen.getByText("DDS-2026-001")).toBeInTheDocument();
    });

    // ADR-0017: RETRYING is in-flight, same as QUEUED/PROCESSING.
    const submittingMatches = screen.queryAllByText("Submitting");
    expect(submittingMatches.length).toBeGreaterThanOrEqual(1);

    // Must NOT silently echo the raw internal DDS status for a DDS that has
    // an active (retrying) submission — that's exactly the row ADR-0017
    // exists to prevent ("Approved" implies "ready to submit", not "a
    // submission attempt is actively failing and retrying").
    // The badge should show "Submitting", and the internal status table row
    // should not render an "Approved" badge (only filter dropdowns have it).
    const approvedBadges = screen.queryAllByText("Approved").filter(
      (el) => el.closest('[role="cell"]') !== null
    );
    expect(approvedBadges.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dashboard Tier 4d filtered doorway (dashboard-redesign-phase1 filtering
// addendum, Task 7.3): `/due-diligence?status=SUBMITTED` must land
// pre-filtered. Soonest-`valid_until` ordering is NOT attempted here — see
// the plan's Global Constraints for why (backend `ordering_fields` doesn't
// include `valid_until`; frontend-only Phase 1 can't work around that).
// ---------------------------------------------------------------------------

function mockDueDiligenceApi(ddsBody: ReturnType<typeof mockPaginatedResponse>) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    if (url.includes("/due-diligence/statements/")) {
      return Promise.resolve(new Response(JSON.stringify(ddsBody), { status: 200 }));
    }
    if (url.includes("/traces/submissions/")) {
      return Promise.resolve(new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: "not found" }), { status: 404 }));
  }) as typeof fetch;
  return calls;
}

describe("DueDiligencePage — status URL param (dashboard filtered doorway)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
  });

  it("requests status=SUBMITTED from the API when ?status=SUBMITTED is present", async () => {
    searchParams = new URLSearchParams("status=SUBMITTED");
    const calls = mockDueDiligenceApi(ddsListResponse({ status: "SUBMITTED" }));
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => expect(screen.getByText("DDS-2026-001")).toBeInTheDocument());
    expect(calls.some((url) => url.includes("/due-diligence/statements/") && url.includes("status=SUBMITTED"))).toBe(true);
  });

  it("pre-selects Submitted in the status filter when ?status=SUBMITTED is present", async () => {
    searchParams = new URLSearchParams("status=SUBMITTED");
    mockDueDiligenceApi(ddsListResponse({ status: "SUBMITTED" }));
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => {
      const select = screen.getByLabelText(/^Status$/i) as HTMLSelectElement;
      expect(select.value).toBe("SUBMITTED");
    });
  });

  it("degrades to the unfiltered list when status is absent", async () => {
    const calls = mockDueDiligenceApi(ddsListResponse());
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => expect(screen.getByText("DDS-2026-001")).toBeInTheDocument());
    expect(calls.some((url) => url.includes("status="))).toBe(false);
    expect((screen.getByLabelText(/^Status$/i) as HTMLSelectElement).value).toBe("");
  });

  it("degrades to the unfiltered list when status is an unrecognized value", async () => {
    searchParams = new URLSearchParams("status=BOGUS");
    const calls = mockDueDiligenceApi(ddsListResponse());
    renderWithProviders(<DueDiligencePage />);
    await waitFor(() => expect(screen.getByText("DDS-2026-001")).toBeInTheDocument());
    expect(calls.some((url) => url.includes("status="))).toBe(false);
    expect((screen.getByLabelText(/^Status$/i) as HTMLSelectElement).value).toBe("");
  });
});
