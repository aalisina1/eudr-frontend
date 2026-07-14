import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TonnageBar, CoverageLegend } from "@/components/sourcing/tonnage-bar";

describe("TonnageBar", () => {
  it("exposes the full coverage breakdown via the accessible label", () => {
    render(<TonnageBar ordered={500} allocated={300} geolocated={280} filed={250} unit=" t" />);
    expect(
      screen.getByLabelText("500 t ordered · 300 t allocated · 280 t geolocated · 250 t filed · 250 t uncovered")
    ).toBeInTheDocument();
  });

  it("renders one segment per non-zero stage (filed/geolocated-delta/allocated-delta)", () => {
    const { container } = render(<TonnageBar ordered={500} allocated={300} geolocated={280} filed={250} />);
    const bar = container.querySelector("[aria-label]");
    // 3 child segment spans: filed (250), geolocated-filed (30), allocated-geolocated (20)
    expect(bar?.children.length).toBe(3);
  });

  it("does not render a zero-width segment (e.g. a fully-Open PO with nothing allocated yet)", () => {
    const { container } = render(<TonnageBar ordered={325} allocated={0} geolocated={0} filed={0} />);
    const bar = container.querySelector("[aria-label]");
    expect(bar?.children.length).toBe(0);
  });

  it("guards against a divide-by-zero when ordered is 0", () => {
    render(<TonnageBar ordered={0} allocated={0} geolocated={0} filed={0} />);
    expect(screen.getByLabelText(/0 ordered/)).toBeInTheDocument();
  });
});

describe("CoverageLegend", () => {
  it("renders the four swatches in Filed/Geolocated/Allocated/Uncovered order", () => {
    const { container } = render(<CoverageLegend />);
    expect(screen.getByText("Filed")).toBeInTheDocument();
    expect(screen.getByText("Geolocated")).toBeInTheDocument();
    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(screen.getByText("Uncovered")).toBeInTheDocument();

    const order = Array.from(container.querySelectorAll("span.font-mono")).map((el) => el.textContent);
    expect(order).toEqual(["Filed", "Geolocated", "Allocated", "Uncovered"]);
  });
});
