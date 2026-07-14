import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkCard, WorkRow, RefLink } from "@/components/dashboard/work-card";

describe("WorkCard", () => {
  it("renders title, description, and a count badge when count > 0", () => {
    render(
      <WorkCard title="Needs filing" description="Ready-to-file purchase orders" count={2} emptyText="All covered">
        <div>row content</div>
      </WorkCard>
    );
    expect(screen.getByText("Needs filing")).toBeInTheDocument();
    expect(screen.getByText("Ready-to-file purchase orders")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("row content")).toBeInTheDocument();
  });

  it("does not render a count badge when count is 0", () => {
    render(
      <WorkCard title="Needs filing" description="desc" count={0} emptyText="Nothing needs filing — all covered">
        <div>row content</div>
      </WorkCard>
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders the quiet empty line (with a check icon) instead of children when count is 0", () => {
    render(
      <WorkCard title="Needs filing" description="desc" count={0} emptyText="Nothing needs filing — all covered">
        <div>row content</div>
      </WorkCard>
    );
    expect(screen.getByText("Nothing needs filing — all covered")).toBeInTheDocument();
    expect(screen.queryByText("row content")).not.toBeInTheDocument();
  });

  it("renders skeleton placeholders instead of the empty line while loading", () => {
    const { container } = render(
      <WorkCard title="Needs filing" description="desc" count={0} emptyText="Nothing needs filing" isLoading>
        <div>row content</div>
      </WorkCard>
    );
    expect(screen.queryByText("Nothing needs filing")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});

describe("WorkRow / RefLink", () => {
  it("renders a mono reference link pointing at the given href", () => {
    render(
      <WorkRow>
        <RefLink href="/supply-chains/po-1">PO-2026-0141</RefLink>
      </WorkRow>
    );
    const link = screen.getByRole("link", { name: "PO-2026-0141" });
    expect(link).toHaveAttribute("href", "/supply-chains/po-1");
  });
});
