import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { PageHeader } from "@/components/page-header";
import { DetailHeader } from "@/components/detail-header";
import { renderWithProviders } from "./helpers";

/**
 * One page header, one detail header (eudr-frontend#167).
 *
 * Before this, list pages set their title at three sizes (2xl on eight pages,
 * 3xl on two, 4xl on five) and detail pages used three treatments (sans xl
 * inside a card; italic serif 3xl; italic serif 4xl with an eyebrow). Moving
 * between screens changed the chrome as well as the content. Now every page
 * under (dashboard) takes its <h1> from one of two components, and this test
 * is what keeps a fourth treatment from appearing: the only <h1> allowed in a
 * page or a feature component is the one these two render.
 */

const SRC = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

describe("PageHeader", () => {
  it("renders the title as the page's h1, the purpose line, and the actions", () => {
    renderWithProviders(
      <PageHeader
        title="Suppliers"
        description="Who you buy from"
        actions={<button type="button">Add supplier</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Suppliers" })).toBeInTheDocument();
    expect(screen.getByText("Who you buy from")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add supplier" })).toBeInTheDocument();
  });

  it("sets the title in the display face at the one page size", () => {
    renderWithProviders(<PageHeader title="Sourcing" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("text-display");
    expect(h1.className).toContain("text-4xl");
  });
});

describe("DetailHeader", () => {
  it("renders eyebrow, title, status beside the title (not inside it), context and actions", () => {
    renderWithProviders(
      <DetailHeader
        back={{ href: "/sourcing", label: "All purchase orders" }}
        eyebrow="Purchase order"
        title="PO-2026-0227"
        status={<span data-testid="chip">Blocked</span>}
        context="Abidjan Cacao SARL · CI · Cocoa"
        actions={<button type="button">File DDS</button>}
      />,
    );
    // The heading's accessible name is the reference alone, which is what
    // every e2e journey locates it by.
    expect(screen.getByRole("heading", { level: 1, name: "PO-2026-0227" })).toBeInTheDocument();
    expect(screen.getByText("Purchase order")).toBeInTheDocument();
    expect(screen.getByTestId("chip")).toBeInTheDocument();
    expect(screen.getByText("Abidjan Cacao SARL · CI · Cocoa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "File DDS" })).toBeInTheDocument();
    // The back control is a button (three journeys click it by role).
    expect(screen.getByRole("button", { name: "All purchase orders" })).toBeInTheDocument();
  });

  it("sets the title at the one detail size, a step under the page size", () => {
    renderWithProviders(
      <DetailHeader back={{ href: "/x", label: "Back" }} eyebrow="Thing" title="T-1" />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("text-display");
    expect(h1.className).toContain("text-3xl");
  });
});

describe("every dashboard page takes its h1 from PageHeader or DetailHeader", () => {
  // Auth screens (sign-in, accept-invitation) carry their own centred layout
  // with no app chrome, like the login page outside (dashboard); they are
  // not page headers and are left out on purpose.
  const pages = [
    ...walk(join(SRC, "app", "(dashboard)")),
    ...walk(join(SRC, "components", "admin")),
    ...walk(join(SRC, "components", "due-diligence")),
  ].filter((p) => !/accept-invitation\.tsx$/.test(p));

  it("scans a real set of files", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it("no page or feature component renders its own <h1>", () => {
    const offenders = pages.filter((p) => /<h1[\s>]/.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(SRC, "src"))).toEqual([]);
  });

  it("no page sets a display title size by hand", () => {
    // `text-display text-2xl`, `text-4xl ... text-display`: the sizes are the
    // components' business now.
    const re = /text-display[^"`]*text-[2-6]xl|text-[2-6]xl[^"`]*text-display/;
    const offenders = pages.filter((p) => re.test(readFileSync(p, "utf8")));
    expect(offenders.map((p) => p.replace(SRC, "src"))).toEqual([]);
  });
});
