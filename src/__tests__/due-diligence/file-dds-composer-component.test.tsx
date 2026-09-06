/**
 * Component tests for the File DDS composition page (#26) — prefill,
 * checked-lot recompute, the payload meter's under-/over-limit frames plus
 * the split-by-shipment suggestion, the 72h AlertDialog, and the
 * save-draft/submit-to-TRACES hand-off. Complements the pure-logic tests in
 * `file-dds-composer.test.ts` and the e2e journey in
 * `e2e/05-due-diligence.spec.ts`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers";
import { FileDdsComposer } from "@/components/due-diligence/file-dds-composer";
import type {
  Organization,
  POReadinessDetail,
  PayloadEstimateResponse,
  Product,
  Supplier,
} from "@/lib/api/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const PO: POReadinessDetail = {
  id: "po-1",
  reference_number: "PO-2026-0219",
  seller_id: "sup-1",
  buyer_id: "buyer-1",
  product_id: "prod-1",
  transaction_date: "2026-06-01",
  stage: "READY",
  blocked: false,
  blockers: [],
  funnel: {
    unit: "KG",
    ordered_quantity: "50000.0000",
    allocated_quantity: "50000.0000",
    geolocated_quantity: "50000.0000",
    filed_quantity: "0",
    uncovered_quantity: "50000.0000",
  },
  lot_count: 2,
  next_deadline: null,
  lots: [
    {
      id: "lot-1",
      reference_number: "LOT-GH-26-0001",
      quantity: "25000.0000",
      unit: "KG",
      harvest_period_start: "2025-10-01",
      harvest_period_end: "2025-11-01",
      plot_count: 12,
      plots_resolved: true,
      plots_failed_count: 0,
      plots_pending_count: 0,
      filed: false,
      filing_dds_id: null,
      filing_dds_reference: "",
      shipment_reference: "MV Elbe Trader",
    },
    {
      id: "lot-2",
      reference_number: "LOT-GH-26-0002",
      quantity: "25000.0000",
      unit: "KG",
      harvest_period_start: "2025-09-01",
      harvest_period_end: "2025-12-01",
      plot_count: 8,
      plots_resolved: true,
      plots_failed_count: 0,
      plots_pending_count: 0,
      filed: false,
      filing_dds_id: null,
      filing_dds_reference: "",
      shipment_reference: "MV Baltic Star",
    },
  ],
};

const SUPPLIER: Supplier = {
  id: "sup-1",
  name: "Kuapa Kokoo Union",
  country_of_origin: "GH",
  kyc_status: "VERIFIED",
  risk_rating: "LOW",
  external_id: "",
  managed_by_id: "u1",
  supplier_organization_id: null,
  kyc_verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as Supplier;

const PRODUCT: Product = {
  id: "prod-1",
  commodity: "cocoa",
  commodity_name: "Cocoa",
  species: null,
  description: "Fermented cocoa beans",
  internal_product_code: "COC-1",
  cn_code: "1801000000",
  is_active: true,
};

const UNDER_LIMIT_ESTIMATE: PayloadEstimateResponse = {
  estimated_bytes: 18_400_000,
  limit_bytes: 25_000_000,
  exceeds_limit: false,
  batches: [
    { batch_id: "lot-1", shipment_reference: "MV Elbe Trader", plot_count: 12, estimated_bytes: 9_200_000 },
    { batch_id: "lot-2", shipment_reference: "MV Baltic Star", plot_count: 8, estimated_bytes: 9_200_000 },
  ],
  errors: [],
};

const OVER_LIMIT_ESTIMATE: PayloadEstimateResponse = {
  estimated_bytes: 31_200_000,
  limit_bytes: 25_000_000,
  exceeds_limit: true,
  batches: [
    { batch_id: "lot-1", shipment_reference: "MV Elbe Trader", plot_count: 12, estimated_bytes: 14_100_000 },
    { batch_id: "lot-2", shipment_reference: "MV Baltic Star", plot_count: 8, estimated_bytes: 17_100_000 },
  ],
  errors: [],
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface FetchOptions {
  po?: POReadinessDetail;
  estimate?: PayloadEstimateResponse;
  createResponse?: unknown;
  submitForReviewOk?: boolean;
  organization?: Partial<Organization>;
  /** GET /accounts/organization/ is `IsAdmin`-gated server-side, so a
   * COMPLIANCE_OFFICER — the role this composer exists for — gets a 403. */
  organizationStatus?: number;
}

function makeFetch({
  po = PO,
  estimate = UNDER_LIMIT_ESTIMATE,
  createResponse = { id: "new-dds-1" },
  submitForReviewOk = true,
  organization = { id: "org-1", default_activity_type: "IMPORT" },
  organizationStatus = 200,
}: FetchOptions = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/accounts/organization/")) {
      return organizationStatus === 200
        ? jsonResponse(organization)
        : jsonResponse(
            { detail: "You do not have permission to access this resource." },
            organizationStatus,
          );
    }
    if (url.includes("/batches/po-1/readiness/")) return jsonResponse(po);
    if (url.includes("/suppliers/sup-1/")) return jsonResponse(SUPPLIER);
    if (url.includes("/commodities/products/prod-1/")) return jsonResponse(PRODUCT);
    if (url.includes("/batches/payload-estimate/") && method === "POST") return jsonResponse(estimate);
    if (url.includes("/submit-for-review/") && method === "POST") {
      return submitForReviewOk ? jsonResponse(createResponse) : jsonResponse({ detail: "cannot submit" }, 400);
    }
    if (url.endsWith("/due-diligence/statements/") && method === "POST") return jsonResponse(createResponse);
    return jsonResponse({ detail: "not found" }, 404);
  });
}

const originalFetch = globalThis.fetch;

describe("FileDdsComposer", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    push.mockClear();
  });

  it("renders the header pre-filled from the PO and the covered lots, all checked by default", async () => {
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);

    expect(await screen.findByRole("heading", { name: "New due diligence statement" })).toBeInTheDocument();
    expect(screen.getByText("Pre-filled from PO-2026-0219")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());
    expect(screen.getByText("LOT-GH-26-0002")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 lots selected")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    // 1 "select all" + 1 per lot = 3, all checked.
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((cb) => expect(cb).toHaveAttribute("aria-checked", "true"));
  });

  it("falls back to the payload-estimate's per-batch shipment_reference when the readiness lot row doesn't carry one yet", async () => {
    // The readiness detail endpoint doesn't populate `LotReadiness.shipment_reference`
    // on real backend main yet (documented FOLLOW-UP in `lib/api/types.ts`) — this
    // mirrors that live gap, while the payload-estimate response (a required
    // field there) still has it.
    const poWithoutShipmentOnLots: POReadinessDetail = {
      ...PO,
      lots: PO.lots.map((lot) => {
        const rest = { ...lot };
        delete rest.shipment_reference;
        return rest;
      }),
    };
    globalThis.fetch = makeFetch({ po: poWithoutShipmentOnLots, estimate: UNDER_LIMIT_ESTIMATE });
    renderWithProviders(<FileDdsComposer poId="po-1" />);

    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());
    expect(await screen.findByText("MV Elbe Trader")).toBeInTheDocument();
    expect(await screen.findByText("MV Baltic Star")).toBeInTheDocument();
  });

  it("GETs the readiness endpoint with an encoded PO id (query-param injection guard)", async () => {
    const fetchSpy = makeFetch();
    globalThis.fetch = fetchSpy;
    renderWithProviders(<FileDdsComposer poId="po-1/../evil?x=1" />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const calledUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes(encodeURIComponent("po-1/../evil?x=1")))).toBe(true);
    // The raw, unencoded id must never appear as a literal path segment.
    expect(calledUrls.some((u) => u.includes("/batches/po-1/../evil?x=1/readiness/"))).toBe(false);
  });

  it("recomputes the declaration summary's net mass when a lot is unchecked", async () => {
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);

    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());
    expect(screen.getByText("50 t")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Select LOT-GH-26-0002" }));

    await waitFor(() => expect(screen.getByText("1 of 2 lots selected")).toBeInTheDocument());
    expect(screen.getByText("25 t")).toBeInTheDocument();
  });

  it("shows the harvest period range (min start – max end) across checked lots", async () => {
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());
    // lot-1: Oct–Nov 2025, lot-2: Sep–Dec 2025 -> Sep – Dec 2025.
    expect(await screen.findByText("Sep – Dec 2025")).toBeInTheDocument();
  });

  it("renders the under-limit payload meter in its primary frame", async () => {
    globalThis.fetch = makeFetch({ estimate: UNDER_LIMIT_ESTIMATE });
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    expect(await screen.findByText("Estimated payload 18.4 MB of 25.0 MB limit")).toBeInTheDocument();
  });

  it("renders the over-limit destructive frame with a split-by-shipment suggestion", async () => {
    globalThis.fetch = makeFetch({ estimate: OVER_LIMIT_ESTIMATE });
    renderWithProviders(<FileDdsComposer poId="po-1" />);

    expect(await screen.findByText("31.2 MB, over the TRACES 25.0 MB limit")).toBeInTheDocument();
    expect(
      screen.getByText(/Split into 2 statements by shipment: MV Elbe Trader \(14\.1 MB\) · MV Baltic Star \(17\.1 MB\)/),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Split by shipment" }));

    // Applying the split narrows the checked set to the first group only.
    await waitFor(() => expect(screen.getByText("1 of 2 lots selected")).toBeInTheDocument());
  });

  it("opens the 72h-lock AlertDialog on Submit to TRACES with the warning copy", async () => {
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Submit to TRACES/ }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Submit to TRACES?")).toBeInTheDocument();
    expect(screen.getByText(/locks\. You have 72 hours to amend it/)).toBeInTheDocument();
  });

  it("confirming Submit statement creates the DDS with the checked batch_ids, submits it for review, and hands off to the DDS detail page", async () => {
    const fetchSpy = makeFetch({ createResponse: { id: "new-dds-1" } });
    globalThis.fetch = fetchSpy;
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Submit to TRACES/ }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Submit statement" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/due-diligence/new-dds-1"));

    const createCall = fetchSpy.mock.calls.find(
      (c) => String(c[0]).endsWith("/due-diligence/statements/") && (c[1] as RequestInit)?.method === "POST",
    );
    expect(createCall).toBeDefined();
    const body = JSON.parse((createCall![1] as RequestInit).body as string);
    expect(body.batch_ids.sort()).toEqual(["lot-1", "lot-2"]);

    const reviewCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/submit-for-review/"));
    expect(reviewCall).toBeDefined();
  });

  it("Save draft creates the DDS WITHOUT submitting it for review, and still hands off to the detail page", async () => {
    const fetchSpy = makeFetch({ createResponse: { id: "draft-dds-1" } });
    globalThis.fetch = fetchSpy;
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/due-diligence/draft-dds-1"));
    const reviewCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/submit-for-review/"));
    expect(reviewCall).toBeUndefined();
  });

  it("no longer offers the 'Add lots from other POs' escape hatch", async () => {
    /** Reversed deliberately. This asserted the button opened the freeform
     * "New DDS" sheet — which was true, and was the defect: that sheet has no
     * lot selection, so the control promised precisely what it could not do,
     * and what it produced covered nothing. `commodities` is mandatory in the
     * TRACES XSD, so every statement it created was unfilable (#104).
     *
     * Cross-PO composition is a real need and this never met it. EUDR's own
     * mechanism is a Group Head (Information System release 8.2.1), which
     * references previously submitted DDS or SD members by reference *and*
     * verification number — neither of which anything here collects. */
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());

    expect(
      screen.queryByRole("button", { name: /Add lots from other POs/ }),
    ).toBeNull();
  });

  it("shows a not-found message when the PO fails to load", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ detail: "not found" }, 404));
    renderWithProviders(<FileDdsComposer poId="missing-po" />);
    expect(await screen.findByText("Purchase order not found or failed to load.")).toBeInTheDocument();
  });

  it("disables Save draft and Submit to TRACES once every lot is unchecked", async () => {
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await waitFor(() => expect(screen.getByText("LOT-GH-26-0001")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: "Select all lots" }));

    await waitFor(() => expect(screen.getByText("0 of 2 lots selected")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Submit to TRACES/ })).toBeDisabled();
  });
});


// ── activity type ────────────────────────────────────────────────────────────
//
// Nothing ever set `activity_type`: the composer POSTed only
// {statement_type, batch_ids}, and the envelope silently rendered the resulting
// blank as DOMESTIC — a false claim of EU production on a filing to a
// regulator. The operator's default now seeds it, and the officer must be able
// to see and override what is about to be declared on their behalf.

describe("FileDdsComposer — activity type", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("prefills from the operator's default and sends it on create", async () => {
    const fetchSpy = makeFetch();
    globalThis.fetch = fetchSpy;
    const user = userEvent.setup();

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    const select = (await screen.findByLabelText(
      /activity/i,
    )) as HTMLSelectElement;
    expect(select.value).toBe("IMPORT");

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([u, i]) =>
          u.toString().endsWith("/due-diligence/statements/") &&
          (i as RequestInit)?.method === "POST",
      );
      expect(call).toBeDefined();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toMatchObject({
        activity_type: "IMPORT",
      });
    });
  });

  it("sends the officer's override rather than the default", async () => {
    const fetchSpy = makeFetch();
    globalThis.fetch = fetchSpy;
    const user = userEvent.setup();

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    await user.selectOptions(await screen.findByLabelText(/activity/i), "EXPORT");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([u, i]) =>
          u.toString().endsWith("/due-diligence/statements/") &&
          (i as RequestInit)?.method === "POST",
      );
      expect(JSON.parse((call![1] as RequestInit).body as string)).toMatchObject({
        activity_type: "EXPORT",
      });
    });
  });

  it("blocks filing when the operator has no default and none is chosen", async () => {
    globalThis.fetch = makeFetch({
      organization: { id: "org-1", default_activity_type: "" },
    });
    const user = userEvent.setup();

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    expect(
      ((await screen.findByLabelText(/activity/i)) as HTMLSelectElement).value,
    ).toBe("");
    expect(screen.getByRole("button", { name: /save draft/i })).toBeDisabled();
  });

  it("names the three activities in the regulator's own terms", async () => {
    globalThis.fetch = makeFetch();
    const user = userEvent.setup();

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    const select = (await screen.findByLabelText(
      /activity/i,
    )) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "",
      "DOMESTIC",
      "IMPORT",
      "EXPORT",
    ]);
  });
});

// ── post-merge audit of #101 (qa/post-merge-audit-frontend) ──────────────────
//
// Two mutants survived the tests that shipped with #101:
//
//   1. `chosenActivityType ?? orgDefault` → `|| orgDefault` — the whole
//      documented point of the `??` (an explicit blank choice is a choice, and
//      must not be silently re-filled from the org default) was unasserted.
//   2. Dropping `|| !activityType` from the *Submit to TRACES* button — only
//      "Save draft" was proven gated, so the more consequential of the two
//      file actions could have shipped ungated.
//
// The third case here is a defect, not a gap: GET /accounts/organization/ is
// `IsAdmin`-gated (`apps/accounts/views.py::OrganizationDetailView`), while
// this composer is `IsComplianceOfficer`-gated — its own docstring says so.
// The prefill therefore never works for the role the screen was built for.

describe("FileDdsComposer — activity type, audit coverage", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("treats an explicit blank as a choice, not as 'unset'", async () => {
    // Guards the `??`. With `||`, clearing the select would snap straight back
    // to IMPORT and re-enable filing — the officer would file the org default
    // they had just deliberately cleared.
    globalThis.fetch = makeFetch({
      organization: { id: "org-1", default_activity_type: "IMPORT" },
    });
    const user = userEvent.setup();

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    const select = (await screen.findByLabelText(/activity/i)) as HTMLSelectElement;
    expect(select.value).toBe("IMPORT");

    await user.selectOptions(select, "");

    expect(select.value).toBe("");
    expect(screen.getByRole("button", { name: /save draft/i })).toBeDisabled();
  });

  it("gates Submit to TRACES on the activity too, not only Save draft", async () => {
    globalThis.fetch = makeFetch({
      organization: { id: "org-1", default_activity_type: "" },
    });

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");
    await screen.findByLabelText(/activity/i);

    expect(screen.getByRole("button", { name: /submit to traces/i })).toBeDisabled();
  });

  it("re-enables both file actions once an activity is chosen", async () => {
    // Negative control for the two gate assertions above: they must fail for a
    // real reason, not because these buttons are disabled by something else.
    globalThis.fetch = makeFetch({
      organization: { id: "org-1", default_activity_type: "" },
    });
    const user = userEvent.setup();

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    await user.selectOptions(await screen.findByLabelText(/activity/i), "EXPORT");

    expect(screen.getByRole("button", { name: /save draft/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /submit to traces/i })).toBeEnabled();
  });

  it("still lets a compliance officer file when the org endpoint refuses them", async () => {
    // The degradation is not fatal — this passes today. Recorded so the 403
    // path has a green baseline that a future change would have to break.
    const fetchSpy = makeFetch({ organizationStatus: 403 });
    globalThis.fetch = fetchSpy;
    const user = userEvent.setup();

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    const select = (await screen.findByLabelText(/activity/i)) as HTMLSelectElement;
    expect(select.value).toBe("");

    await user.selectOptions(select, "IMPORT");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(
        ([u, i]) =>
          u.toString().endsWith("/due-diligence/statements/") &&
          (i as RequestInit)?.method === "POST",
      );
      expect(call).toBeDefined();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toMatchObject({
        activity_type: "IMPORT",
      });
    });
  });

  it("does not tell a user who cannot read the org to go and set a default in Settings", async () => {
    // FAILING BY DESIGN — demonstrates the defect.
    //
    // A COMPLIANCE_OFFICER gets 403 from GET /accounts/organization/, so
    // `orgDefault` is "" and the composer prints "Set a default in Settings to
    // prefill this." Settings' Operator identity card is fed by that same
    // admin-only endpoint, so it renders "Unable to load operator identity."
    // for them. The instruction names a screen they cannot act on.
    //
    // The distinction the copy fails to make: "your operator has no default"
    // and "you were not allowed to look" are different states.
    globalThis.fetch = makeFetch({ organizationStatus: 403 });

    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");
    await screen.findByLabelText(/activity/i);

    expect(screen.queryByText(/set a default in settings/i)).toBeNull();
  });
});


describe("FileDdsComposer — no escape hatch that cannot do what it says", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("does not offer 'Add lots from other POs'", async () => {
    /** That button opened `DDSForm`, which has no lot selection at all — it
     * promised precisely the thing it could not do, and produced a statement
     * covering nothing (#104). Cross-PO composition is a real need; EUDR's own
     * mechanism is a Group Head, which references submitted statements by
     * reference *and* verification number. */
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);
    await screen.findByText("LOT-GH-26-0001");

    expect(
      screen.queryByRole("button", { name: /add lots from other/i }),
    ).toBeNull();
  });

  it("still shows the covered lots it does own", async () => {
    /** Negative control: the card the button lived on must survive. */
    globalThis.fetch = makeFetch();
    renderWithProviders(<FileDdsComposer poId="po-1" />);

    expect(await screen.findByText("LOT-GH-26-0001")).toBeInTheDocument();
    expect(screen.getByText(/covered lots/i)).toBeInTheDocument();
  });
});
