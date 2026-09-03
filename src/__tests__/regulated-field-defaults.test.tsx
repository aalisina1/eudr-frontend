/**
 * Forms must not supply values for regulated fields the user has not entered.
 *
 * The rule these tests encode, drawn from the sweep that followed #105 (a
 * confirmation dialog rendering `activityType || "DOMESTIC"`):
 *
 *   A default that describes WHAT YOU ARE DOING NOW is a convenience.
 *   A default that asserts WHAT WAS ALREADY TRUE is a claim.
 *
 * `transaction_date` defaulting to today is the first kind and is left alone.
 * `collection_date` and `risk_rating` are the second kind: the collection
 * already happened, at a time the form cannot know, and a risk rating is a
 * conclusion somebody has to reach.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import { PlotForm } from "@/components/forms/plot-form";
import { SupplierForm } from "@/components/forms/supplier-form";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe("PlotForm — collection date", () => {
  it("does not pre-fill today's date", () => {
    renderWithProviders(<PlotForm open onOpenChange={() => {}} />);

    const input = screen.getByLabelText(/collection date/i) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("does not pre-fill any date at all", () => {
    /** Guards the whole class, not just today: any pre-filled date is a claim
     * about when evidence was gathered. */
    renderWithProviders(<PlotForm open onOpenChange={() => {}} />);

    const input = screen.getByLabelText(/collection date/i) as HTMLInputElement;
    expect(input.value).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("says what the date means, since it is no longer filled in", () => {
    renderWithProviders(<PlotForm open onOpenChange={() => {}} />);

    expect(
      screen.getByText(/when the geolocation was collected/i),
    ).toBeInTheDocument();
  });
});

describe("SupplierForm — risk rating", () => {
  it("defaults to Not assessed rather than asserting a conclusion", () => {
    renderWithProviders(<SupplierForm open onOpenChange={() => {}} />);

    const select = screen.getByLabelText(/risk rating/i) as HTMLSelectElement;
    expect(select.value).toBe("NOT_ASSESSED");
  });

  it("offers Not assessed alongside the three real conclusions", () => {
    renderWithProviders(<SupplierForm open onOpenChange={() => {}} />);

    const select = screen.getByLabelText(/risk rating/i) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "NOT_ASSESSED",
      "LOW",
      "STANDARD",
      "HIGH",
    ]);
  });

  it("still defaults KYC to Pending", () => {
    /** Negative control: PENDING is honest — it says no verification has
     * happened — and must not be swept up in this change. */
    renderWithProviders(<SupplierForm open onOpenChange={() => {}} />);

    const select = screen.getByLabelText(/kyc status/i) as HTMLSelectElement;
    expect(select.value).toBe("PENDING");
  });
});

// ── post-merge audit of #101 (qa/post-merge-audit-frontend) ──────────────────
//
// #101 made the commercial activity an explicit, officer-visible, required
// choice — in the composer. It is not the only door to a DDS. The freeform
// "New Statement" sheet (`DDSForm`) is reachable from the Submissions page
// header AND from the composer's own escape hatch
// (`file-dds-composer.tsx:666`), and it POSTs `values` with no
// `activity_type` at all.
//
// The backend then applies one for the officer: `DueDiligenceStatement.save()`
// seeds a blank `activity_type` from `Organization.default_activity_type` on
// first save. That is the same shape as the defect this file exists to
// prevent — a regulated value supplied by something other than the person
// signing for it — only now it happens server-side, where the officer cannot
// see it. If the operator has no default it instead stays blank and the
// statement is refused at submit time, on a different screen, days later.

describe("DDSForm — the freeform statement path", () => {
  it("lets the officer choose the commercial activity, as the composer does", async () => {
    // FAILING BY DESIGN — demonstrates the gap. `DDSForm` has no activity
    // control and, before this test, no test file of any kind referenced it.
    const { DDSForm } = await import("@/components/forms/dds-form");
    renderWithProviders(<DDSForm open onOpenChange={() => {}} />);

    expect(screen.getByLabelText(/activity/i)).toBeInTheDocument();
  });

  it("does render the statement type it does own", async () => {
    // Negative control: the sheet renders, and its selects are label-
    // associated — so the assertion above fails for the missing field, not
    // for a broken render or an unlabelled control.
    const { DDSForm } = await import("@/components/forms/dds-form");
    renderWithProviders(<DDSForm open onOpenChange={() => {}} />);

    expect(screen.getByLabelText(/statement type/i)).toBeInTheDocument();
  });
});
