/**
 * The header's Withdraw button withdraws *locally* — it flips
 * `DueDiligenceStatement.status` and tells the regulator nothing.
 *
 * That is only ever correct for a statement TRACES has no record of (seeded
 * and legacy rows). For anything TRACES actually holds, a local withdrawal
 * would show an officer their statement as withdrawn while the regulator
 * still held it live and enforceable — the single most dangerous false
 * negative a compliance tool can produce. The backend now refuses that path
 * with a 409; this page must not offer it in the first place.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { Suspense } from "react";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import DDSDetailPage from "@/app/(dashboard)/submissions/[id]/page";
import type { DueDiligenceStatement, TracesSubmission } from "@/lib/api/types";

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));
import { authFetch } from "@/lib/api/client";
const mockAuthFetch = vi.mocked(authFetch);

function jsonRes(data: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

function statement(overrides: Partial<DueDiligenceStatement> = {}): DueDiligenceStatement {
  return {
    id: "dds-1",
    reference_number: "DDS-2026-0001",
    traces_reference: "26FREQVKTA7K2V",
    status: "SUBMITTED",
    statement_type: "OPERATOR",
    activity_type: "IMPORT",
    batch_ids: [],
    risk_conclusion: "NEGLIGIBLE",
    conclusion_justification: "",
    operator_id: "org-1",
    created_by_id: "u1",
    reviewed_by_id: null,
    submitted_at: "2026-06-30T00:00:00Z",
    valid_until: null,
    archived_until: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-30T00:00:00Z",
    risk_assessments: [],
    covered_lots: [],
    filing_blockers: [],
    ...overrides,
  };
}

function submission(overrides: Partial<TracesSubmission>): TracesSubmission {
  return {
    id: "sub-1",
    dds_id: "dds-1",
    submission_type: "CREATE",
    status: "SUBMITTED",
    traces_status: "AVAILABLE",
    traces_uuid: "9f925115-2858-4370-9288-2f4c8605c0bb",
    verification_number: "VER-1",
    traces_reference_number: "26FREQVKTA7K2V",
    error_message: "",
    error_detail: [],
    attempt_count: 1,
    last_attempted_at: null,
    next_retry_at: null,
    submitted_at: "2026-06-30T00:00:00Z",
    submitted_by_id: "u1",
    soap_request_payload: "",
    soap_response_payload: "",
    created_at: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

function mockApi(
  latest: TracesSubmission | null,
  stmt: DueDiligenceStatement = statement(),
) {
  mockAuthFetch.mockImplementation((url: string) => {
    if (url.includes("/auth/users/me/")) {
      return Promise.resolve(jsonRes({ id: "u1", role: "COMPLIANCE_OFFICER", organization_id: "org-1" }));
    }
    if (url.includes("/due-diligence/statements/dds-1/")) {
      return Promise.resolve(jsonRes(stmt));
    }
    if (url.includes("/traces/submissions/?dds_id")) {
      return Promise.resolve(jsonRes({ results: latest ? [{ id: latest.id }] : [] }));
    }
    if (latest && url === `/api/v1/traces/submissions/${latest.id}/`) {
      return Promise.resolve(jsonRes(latest));
    }
    return Promise.resolve(jsonRes({}));
  });
}

/** Pre-resolve the `params` thenable via React's "fulfilled thenable" fast
 * path — the App Router's `use(params)` convention otherwise suspends on
 * first render and doesn't reliably flush in this jsdom/Vitest harness. */
function resolvedParams(id: string) {
  const p = Promise.resolve({ id }) as Promise<{ id: string }> & {
    status?: string;
    value?: unknown;
  };
  p.status = "fulfilled";
  p.value = { id };
  return p;
}

function renderPage() {
  return renderWithProviders(
    <Suspense fallback={<div data-testid="page-suspense-fallback" />}>
      <DDSDetailPage params={resolvedParams("dds-1")} />
    </Suspense>,
  );
}

describe("DDS detail — withdrawing a statement TRACES holds", () => {
  afterEach(() => vi.clearAllMocks());

  it("does not offer a local withdrawal for a statement the regulator holds", async () => {
    mockApi(submission({}));
    renderPage();

    await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
    // The TRACES panel's own Withdraw is the real one; the header's is not.
    // `Amend` only ever comes from the panel, so its presence pins that the
    // single Withdraw on the page is the panel's — not the header's with the
    // panel's missing.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^amend$/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByRole("button", { name: /^withdraw$/i })).toHaveLength(1);
  });

  it("still offers it for a submitted statement TRACES has no record of", async () => {
    // Reachable through seeded and legacy rows — statements marked SUBMITTED
    // that predate a working submit path. There is genuinely nothing to
    // retract at the regulator, so the local flip is the whole operation.
    mockApi(null);
    renderPage();

    await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument(),
    );
  });

  it.each(["REJECTED", "ARCHIVED", "OBSOLETE"] as const)(
    "offers it for a filing TRACES has finished with (%s)",
    async (tracesStatus) => {
      // ADR-0017 means a rejection never moves `DDS.status`, so a rejected
      // statement stays SUBMITTED. Treating "has a uuid" as "TRACES holds it"
      // hid the header control, while the panel offers Withdraw only when
      // AVAILABLE — leaving the statement with no route out from either.
      mockApi(submission({ traces_status: tracesStatus }));
      renderPage();

      await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument(),
      );
    },
  );

  it("hides it while the submission is still being fetched", async () => {
    // Two hops (list, then detail) against the statement's one, so the
    // statement almost always resolves first. Rendering the local Withdraw in
    // that window offers a click that the backend answers with a 409 — and
    // before the backend was hardened, one that recorded a statement as
    // withdrawn while the regulator still held it. Fail safe, not fail open.
    let releaseSubmissions: (value: Response) => void = () => {};
    const pendingList = new Promise<Response>((resolve) => {
      releaseSubmissions = resolve;
    });
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/due-diligence/statements/dds-1/")) {
        return Promise.resolve(jsonRes(statement()));
      }
      if (url.includes("/traces/submissions/?dds_id")) return pendingList;
      return Promise.resolve(jsonRes({}));
    });
    renderPage();

    await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^withdraw$/i })).not.toBeInTheDocument();

    releaseSubmissions(jsonRes({ results: [] }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument(),
    );
  });

  it("hides it when the submission lookup fails", async () => {
    // A 403 or a network error is not evidence that TRACES holds nothing.
    mockAuthFetch.mockImplementation((url: string) => {
      if (url.includes("/due-diligence/statements/dds-1/")) {
        return Promise.resolve(jsonRes(statement()));
      }
      if (url.includes("/traces/submissions/?dds_id")) {
        return Promise.resolve(jsonRes({ detail: "Forbidden" }, 403));
      }
      return Promise.resolve(jsonRes({}));
    });
    renderPage();

    await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^withdraw$/i })).not.toBeInTheDocument(),
    );
  });

  it("offers it again once the filing has been withdrawn at TRACES", async () => {
    mockApi(submission({ traces_status: "WITHDRAWN", submission_type: "WITHDRAW" }));
    renderPage();

    await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument(),
    );
    // The panel no longer offers its own — TRACES is done with this filing.
    // (The phrase appears in both the panel body and its timeline step.)
    expect(screen.getAllByText(/withdrawn from traces/i).length).toBeGreaterThan(0);
  });
});

describe("DDS detail — an approved statement that cannot be filed", () => {
  afterEach(() => vi.clearAllMocks());

  it("offers the only exit an APPROVED statement has", async () => {
    // APPROVED has no action but Submit, and Submit fails forever when the
    // statement is unfilable — it cannot be edited, re-reviewed or withdrawn
    // from here. A live prod statement failed on a blank activity type 22
    // times with nothing else on screen to click.
    mockApi(
      null,
      statement({
        status: "APPROVED",
        activity_type: "",
        filing_blockers: [
          {
            field: "activity_type",
            message:
              "activity_type is required and must be one of DOMESTIC, EXPORT, IMPORT (got '').",
          },
        ],
      }),
    );
    renderPage();

    await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
    const button = await screen.findByRole("button", {
      name: /send back for correction/i,
    });
    expect(button).toBeEnabled();
    // And the reason is on the page, not only in a failed submission's JSON.
    expect(screen.getByText("activity_type")).toBeInTheDocument();
  });

  it("does not offer it on a statement TRACES already holds", async () => {
    // Once filed the route is amend or withdraw, not a local status change.
    mockApi(submission({}), statement({ status: "SUBMITTED" }));
    renderPage();

    await waitFor(() => expect(screen.getByText("DDS-2026-0001")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: /send back for correction/i }),
    ).not.toBeInTheDocument();
  });
});
