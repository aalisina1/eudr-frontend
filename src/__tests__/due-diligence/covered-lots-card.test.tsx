import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CoveredLotsCard } from "@/components/due-diligence/covered-lots-card";
import type { CoveredLot, CoveredPlot } from "@/lib/api/types";

function plot(overrides: Partial<CoveredPlot> = {}): CoveredPlot {
  return {
    id: "plot-1",
    reference: "PLOT-000412",
    country: "GH",
    region: "Ashanti",
    area_hectares: "12.5000",
    validation_status: "PASSED",
    resolution_status: "UNRESOLVED",
    ...overrides,
  };
}

function lot(overrides: Partial<CoveredLot> = {}): CoveredLot {
  return {
    id: "batch-1",
    reference_number: "BCH-2026-012",
    quantity: "1000.0000",
    unit: "KG",
    country_of_harvest: "GH",
    harvest_period_start: "2025-10-01",
    harvest_period_end: "2025-12-20",
    plot_count: 1,
    plots: [plot()],
    purchase_orders: [],
    is_purchase_order: false,
    resolved: true,
    ...overrides,
  };
}

describe("CoveredLotsCard", () => {
  it("shows the goods, the ground and the order — the three things a statement declares", () => {
    render(
      <CoveredLotsCard
        lots={[
          lot({
            purchase_orders: [{ id: "po-1", reference_number: "PO-2026-0219" }],
          }),
        ]}
        blockers={[]}
      />,
    );

    expect(screen.getByText("BCH-2026-012")).toBeInTheDocument();
    expect(screen.getByText(/1,000 kg/)).toBeInTheDocument();
    expect(screen.getByText("Oct – Dec 2025")).toBeInTheDocument();
    expect(screen.getByText("PLOT-000412")).toBeInTheDocument();
    expect(screen.getByText(/12.5 ha/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PO-2026-0219" })).toHaveAttribute(
      "href",
      "/sourcing/po-1",
    );
    expect(screen.getByRole("link", { name: /PLOT-000412/ })).toHaveAttribute(
      "href",
      "/plots/plot-1",
    );
  });

  it("says why the statement cannot be filed, above the lots", () => {
    render(
      <CoveredLotsCard
        lots={[lot()]}
        blockers={[
          {
            field: "batch[BCH-2026-012].harvest_period",
            message: "Lot is missing a harvest period.",
          },
        ]}
      />,
    );

    expect(screen.getByText(/1 thing must be fixed before this can be filed/i)).toBeInTheDocument();
    expect(screen.getByText("batch[BCH-2026-012].harvest_period")).toBeInTheDocument();
  });

  it("flags a lot that declares no plots", () => {
    // EUDR's whole claim is about specific ground. A statement with none is
    // not merely incomplete — it declares nothing the regulation asks for.
    render(<CoveredLotsCard lots={[lot({ plot_count: 0, plots: [] })]} blockers={[]} />);

    expect(
      screen.getByText(/a statement must declare the land its goods came from/i),
    ).toBeInTheDocument();
  });

  it("reports a lot the statement claims but the app cannot describe", () => {
    // Hiding it would show an officer a statement covering less than it says.
    render(
      <CoveredLotsCard
        lots={[
          lot({
            id: "ghost-id",
            resolved: false,
            reference_number: "",
            quantity: null,
            plot_count: 0,
            plots: [],
          }),
        ]}
        blockers={[]}
      />,
    );

    expect(screen.getByText(/this lot could not be resolved/i)).toBeInTheDocument();
    expect(screen.getByText("ghost-id")).toBeInTheDocument();
  });

  it("does not let a plot the filing declares disappear silently from the count", () => {
    // `plot_count` is what the filing covers; `plots` is what still resolves.
    // A gap means the statement declares ground the app can no longer
    // describe — a discrepancy an officer has to be told about, not rounded
    // away by rendering whatever happened to come back.
    render(<CoveredLotsCard lots={[lot({ plot_count: 3, plots: [plot()] })]} blockers={[]} />);

    expect(screen.getByText(/2 declared plots could not be resolved/i)).toBeInTheDocument();
  });

  it("still reports the discrepancy when EVERY declared plot fails to resolve", () => {
    // The worst case, and the one the first cut skipped: the warning was
    // nested under `plots.length > 0`, so a lot whose every plot id is a ghost
    // fell into the "No plots" branch — while the card header, summing
    // `plot_count`, said the statement covered three. Two contradictory
    // statements on one card, and the discrepancy the card exists to surface
    // silently dropped.
    render(<CoveredLotsCard lots={[lot({ plot_count: 3, plots: [] })]} blockers={[]} />);

    expect(screen.getByText(/3 declared plots could not be resolved/i)).toBeInTheDocument();
    expect(screen.getByText(/1 lot · 3 plots/i)).toBeInTheDocument();
    // "No plots" would be a different, and wrong, claim: plots ARE declared.
    expect(screen.queryByText(/^No plots/)).not.toBeInTheDocument();
  });

  it("does not claim a statement is empty when the field was simply not sent", () => {
    // `covered_lots` is detail-only, and absent on any list-shaped statement
    // or from a frontend deployed ahead of its backend. Collapsing that into
    // `[]` told every officer that every statement covers nothing and cannot
    // be filed — a confident, false, red assertion.
    render(<CoveredLotsCard lots={undefined} blockers={undefined} />);

    expect(screen.queryByText(/covers no lots/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not available here/i)).toBeInTheDocument();
  });

  it("marks a covered batch that is itself the purchase order", () => {
    // Otherwise an empty PO list on a PO-level statement reads as a broken
    // link rather than as the order itself.
    render(
      <CoveredLotsCard
        lots={[lot({ is_purchase_order: true, purchase_orders: [] })]}
        blockers={[]}
      />,
    );

    expect(screen.getByText("Purchase order")).toBeInTheDocument();
  });

  it("shows a failed deforestation check on the plot that carries it", () => {
    render(
      <CoveredLotsCard
        lots={[lot({ plots: [plot({ validation_status: "FAILED" })] })]}
        blockers={[]}
      />,
    );

    const row = screen.getByRole("link", { name: /PLOT-000412/ });
    expect(within(row).getByText("Deforestation")).toBeInTheDocument();
  });

  it("stays quiet about a plot that passed", () => {
    // A screen where every plot carries a badge is one where the failing plot
    // does not stand out.
    render(<CoveredLotsCard lots={[lot()]} blockers={[]} />);

    const row = screen.getByRole("link", { name: /PLOT-000412/ });
    expect(within(row).queryByText("Deforestation")).not.toBeInTheDocument();
    expect(within(row).queryByText("Not checked")).not.toBeInTheDocument();
  });

  it("does not render an empty statement as a normal one", () => {
    // `commodities` is mandatory in the TRACES XSD, so a statement covering
    // nothing is unfilable rather than merely blank.
    render(<CoveredLotsCard lots={[]} blockers={[]} />);

    expect(screen.getByText(/this statement covers no lots/i)).toBeInTheDocument();
  });

  it("renders before the detail endpoint has answered", () => {
    // `covered_lots` is detail-only, so it is `undefined` on any list-shaped
    // statement — the card must not throw on the field being absent.
    render(<CoveredLotsCard lots={undefined} blockers={undefined} />);

    expect(screen.getByText(/what this statement covers/i)).toBeInTheDocument();
  });
});

describe("CoveredLotsCard — blockers on a statement that is already filed", () => {
  it("does not claim a filed statement cannot be filed", () => {
    // `filing_blockers` is a live dry-run over current batch data, not a
    // record of what was true at filing time. So an AVAILABLE statement whose
    // plots were later excluded started reporting "must be fixed before this
    // can be filed" — printed beside a verification number the regulator
    // issued. The problems are still worth showing; the claim is what changes.
    render(
      <CoveredLotsCard
        lots={[lot()]}
        blockers={[{ field: "batch[X].harvest_period", message: "missing" }]}
        alreadyFiled
      />,
    );

    expect(screen.getByText(/would block re-filing this statement today/i)).toBeInTheDocument();
    expect(screen.queryByText(/before this can be filed/i)).not.toBeInTheDocument();
    // The blocker itself must still be listed either way.
    expect(screen.getByText("batch[X].harvest_period")).toBeInTheDocument();
  });

  it("still says what it means for a statement that has not been filed", () => {
    render(
      <CoveredLotsCard
        lots={[lot()]}
        blockers={[{ field: "batch[X].harvest_period", message: "missing" }]}
      />,
    );

    expect(screen.getByText(/must be fixed before this can be filed/i)).toBeInTheDocument();
  });
});
