import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupplierSourcingCard } from "@/components/sourcing/supplier-sourcing-card";
import type { BatchReadiness } from "@/lib/api/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function po(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-2026-0119",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    product_id: "prod-1",
    transaction_date: "2026-06-01",
    stage: "READY",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "75000.0000",
      allocated_quantity: "75000.0000",
      geolocated_quantity: "75000.0000",
      filed_quantity: "0.0000",
      uncovered_quantity: "75000.0000",
    },
    lot_count: 2,
    next_deadline: null,
    ...overrides,
  };
}

describe("SupplierSourcingCard", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders the card title", () => {
    render(<SupplierSourcingCard pos={[]} />);
    expect(screen.getByText("Sourcing from this supplier")).toBeInTheDocument();
  });

  // The stat line's numbers/labels render as adjacent text nodes split
  // across a nested <span> (see `Stat`), which RTL's default `getByText`
  // won't match as one string — assert against the `CardDescription`
  // container's combined `textContent` instead.
  function statLineText(container: HTMLElement): string {
    return container.querySelector('[data-slot="card-description"]')?.textContent ?? "";
  }

  it("computes the stat line from the supplied readiness rows (open POs, tonnes ordered, % geolocated)", () => {
    const { container } = render(
      <SupplierSourcingCard
        pos={[
          po({ id: "a", funnel: { unit: "KG", ordered_quantity: "1000000.0000", allocated_quantity: "1000000.0000", geolocated_quantity: "800000.0000", filed_quantity: "0", uncovered_quantity: "1000000" } }),
          po({ id: "b", stage: "FILED", funnel: { unit: "KG", ordered_quantity: "500000.0000", allocated_quantity: "500000.0000", geolocated_quantity: "500000.0000", filed_quantity: "500000.0000", uncovered_quantity: "0" } }),
        ]}
      />
    );
    // 1 open PO (the FILED one is excluded from "open"), but the tonnage/
    // geolocated-% stats intentionally sum across the whole season
    // (including already-filed POs) — "ordered this season" is a season
    // total, not just the currently-open subset. Combined allocated
    // 1,500,000 kg, geolocated 1,300,000 kg -> 87%.
    const text = statLineText(container);
    expect(text).toMatch(/1 open PO/);
    expect(text).toMatch(/87%/);
    expect(text).toMatch(/of received volume geolocated/);
  });

  it("renders '—' for percent geolocated when nothing has been allocated yet", () => {
    const { container } = render(
      <SupplierSourcingCard
        pos={[po({ funnel: { unit: "KG", ordered_quantity: "1000", allocated_quantity: "0", geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "1000" } })]}
      />
    );
    expect(statLineText(container)).toMatch(/—\s*of received volume geolocated/);
  });

  it("excludes M3/PIECES-unit POs from the tonnage sum but still counts them as open POs", () => {
    const { container } = render(
      <SupplierSourcingCard
        pos={[po({ id: "m3", funnel: { unit: "M3", ordered_quantity: "40", allocated_quantity: "40", geolocated_quantity: "40", filed_quantity: "0", uncovered_quantity: "40" } })]}
      />
    );
    expect(statLineText(container)).toMatch(/1 open PO/);
  });

  it("renders one row per open PO with reference, coverage caption, deadline chip, and stage badge", () => {
    const { container } = render(
      <SupplierSourcingCard
        pos={[
          po({
            reference_number: "PO-2026-0163",
            stage: "ALLOCATED",
            blocked: true,
            blockers: [{ code: "PLOTS_FAILED_VALIDATION", message: "1 plot failed validation", count: 1 }],
            next_deadline: "2026-07-28",
            funnel: { unit: "KG", ordered_quantity: "150000.0000", allocated_quantity: "150000.0000", geolocated_quantity: "95000.0000", filed_quantity: "0", uncovered_quantity: "150000" },
          }),
        ]}
      />
    );
    expect(screen.getByText("PO-2026-0163")).toBeInTheDocument();
    expect(screen.getByText(/0\s*\/\s*150,?000\s*kg filed/)).toBeInTheDocument();
    expect(screen.getByText(/ETA 28 Jul/)).toBeInTheDocument();
    const badges = Array.from(container.querySelectorAll('[data-slot="badge"]')).map((b) => b.textContent?.trim());
    expect(badges).toContain("Blocked");
    expect(screen.getByText("1 plot failed validation")).toBeInTheDocument();
  });

  it("excludes FILED POs from the compact table", () => {
    render(<SupplierSourcingCard pos={[po({ reference_number: "PO-FILED", stage: "FILED" })]} />);
    expect(screen.queryByText("PO-FILED")).not.toBeInTheDocument();
    expect(screen.getByText(/No open purchase orders/i)).toBeInTheDocument();
  });

  it("sorts blocked POs first, then by soonest deadline", () => {
    const { container } = render(
      <SupplierSourcingCard
        pos={[
          po({ id: "far", reference_number: "PO-FAR", next_deadline: "2026-12-01" }),
          po({ id: "blocked", reference_number: "PO-BLOCKED", blocked: true, next_deadline: "2026-11-01" }),
          po({ id: "near", reference_number: "PO-NEAR", next_deadline: "2026-07-20" }),
        ]}
      />
    );
    const refs = Array.from(container.querySelectorAll("tbody tr")).map((r) => r.querySelector("button")?.textContent);
    expect(refs).toEqual(["PO-BLOCKED", "PO-NEAR", "PO-FAR"]);
  });

  it("navigates to the PO detail route on ref click and on View click", async () => {
    const user = userEvent.setup();
    render(<SupplierSourcingCard pos={[po({ id: "po-xyz", reference_number: "PO-XYZ" })]} />);

    await user.click(screen.getByText("PO-XYZ"));
    expect(push).toHaveBeenCalledWith("/supply-chains/po-xyz");

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(push).toHaveBeenCalledWith("/supply-chains/po-xyz");
  });

  it("renders the sync-provenance footer with a View integration action", async () => {
    const user = userEvent.setup();
    render(<SupplierSourcingCard pos={[]} />);
    expect(screen.getByText(/arrives via your connected integrations/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /View integration/i }));
    expect(push).toHaveBeenCalledWith("/integrations");
  });

  it("shows a loading state and no table while isLoading", () => {
    render(<SupplierSourcingCard pos={[]} isLoading />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
