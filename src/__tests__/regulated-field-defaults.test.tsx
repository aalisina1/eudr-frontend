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
