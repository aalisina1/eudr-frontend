import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupplierDataGapsCard, aggregateSupplierBlockers } from "@/components/sourcing/supplier-data-gaps-card";
import type { BatchReadiness } from "@/lib/api/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function po(overrides: Partial<BatchReadiness> = {}): BatchReadiness {
  return {
    id: "po-1",
    reference_number: "PO-1",
    seller_id: "sup-1",
    buyer_id: "buyer-1",
    product_id: "prod-1",
    transaction_date: "2026-06-01",
    stage: "ALLOCATED",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG",
      ordered_quantity: "1000",
      allocated_quantity: "1000",
      geolocated_quantity: "0",
      filed_quantity: "0",
      uncovered_quantity: "1000",
    },
    lot_count: 1,
    next_deadline: null,
    ...overrides,
  };
}

describe("aggregateSupplierBlockers", () => {
  it("sums counts for the same blocker code across multiple POs", () => {
    const rows = aggregateSupplierBlockers([
      po({ blockers: [{ code: "MISSING_HARVEST_PERIOD", message: "2 lots missing harvest period", count: 2 }] }),
      po({ blockers: [{ code: "MISSING_HARVEST_PERIOD", message: "1 lot missing harvest period", count: 1 }] }),
    ]);
    const row = rows.find((r) => r.code === "MISSING_HARVEST_PERIOD");
    expect(row?.count).toBe(3);
    expect(row?.message).toContain("3 lots");
  });

  it("treats a null count as one occurrence (e.g. NO_LOTS_LINKED, OVER_ALLOCATED)", () => {
    const rows = aggregateSupplierBlockers([
      po({ blockers: [{ code: "NO_LOTS_LINKED", message: "No lots linked yet", count: null }] }),
      po({ id: "po-2", blockers: [{ code: "NO_LOTS_LINKED", message: "No lots linked yet", count: null }] }),
    ]);
    expect(rows.find((r) => r.code === "NO_LOTS_LINKED")?.count).toBe(2);
  });

  it("orders blocking codes before informational-only ones", () => {
    const rows = aggregateSupplierBlockers([
      po({
        blockers: [
          { code: "OVER_ALLOCATED", message: "over-allocated", count: null },
          { code: "PLOTS_FAILED_VALIDATION", message: "1 plot failed deforestation validation", count: 1 },
          { code: "MISSING_HARVEST_PERIOD", message: "1 lot missing harvest period", count: 1 },
        ],
      }),
    ]);
    expect(rows.map((r) => r.code)).toEqual(["PLOTS_FAILED_VALIDATION", "MISSING_HARVEST_PERIOD", "OVER_ALLOCATED"]);
  });

  it("returns an empty list when there are no blockers", () => {
    expect(aggregateSupplierBlockers([po(), po({ id: "po-2" })])).toEqual([]);
  });
});

describe("SupplierDataGapsCard", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders the destructive callout title", () => {
    render(<SupplierDataGapsCard pos={[]} />);
    expect(screen.getByText("Data gaps")).toBeInTheDocument();
  });

  it("renders an 'all clear' positive state when there are no blockers", () => {
    render(<SupplierDataGapsCard pos={[po()]} />);
    expect(screen.getByText(/All data complete/i)).toBeInTheDocument();
  });

  it("renders an aggregated gap row with a deep-link action", async () => {
    const user = userEvent.setup();
    render(
      <SupplierDataGapsCard
        pos={[
          po({ blockers: [{ code: "MISSING_GEOLOCATION", message: "1 lot missing plot geolocation", count: 1 }] }),
        ]}
      />
    );
    expect(screen.getByText(/1 lot missing plot geolocation/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View plots" }));
    expect(push).toHaveBeenCalledWith("/plots");
  });

  it("scrolls to the sourcing table for a lot/PO-shaped gap instead of navigating", async () => {
    const scrollIntoView = vi.fn();
    document.body.innerHTML = '<div id="supplier-sourcing-pos"></div>';
    // jsdom doesn't implement scrollIntoView — stub it on the real element.
    document.getElementById("supplier-sourcing-pos")!.scrollIntoView = scrollIntoView;

    const user = userEvent.setup();
    render(
      <SupplierDataGapsCard
        pos={[po({ blockers: [{ code: "MISSING_HARVEST_PERIOD", message: "2 lots missing harvest period", count: 2 }] })]}
      />
    );
    await user.click(screen.getByRole("button", { name: /View purchase orders/i }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
