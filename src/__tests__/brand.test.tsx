import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GrovetraceMark } from "@/components/brand/grovetrace-mark";
import {
  PRODUCT_NAME,
  PRODUCT_TITLE,
  PRODUCT_DESCRIPTOR,
  PRODUCT_DESCRIPTION,
} from "@/lib/brand";

/**
 * Guards the two things that made the chrome generic in the first place:
 * a stock icon standing in for the real mark, and the product name existing
 * as four different literals because nothing defined it once.
 *
 * The discipline half (nobody reintroduces a hardcoded name) is enforced by
 * the ESLint rule in ADR-0027, not here. This file guards the component
 * contract that rule assumes.
 *
 * Spec: eudr-vault/10-Specs/product-voice-and-identity.md, Decision 1.
 */

describe("GrovetraceMark", () => {
  it("exposes an accessible name, so the logo is not an unlabelled graphic", () => {
    render(<GrovetraceMark />);
    expect(screen.getByRole("img", { name: "Grovetrace" })).toBeInTheDocument();
  });

  it("paints with currentColor so one asset themes to its surface", () => {
    // The brand files ship three hardcoded hexes (#1f6b43, #ffffff, #2e8f5b).
    // Inlining any of them would need a second asset per surface and would
    // silently break in dark mode, which is how the stock icon survived.
    // Both variants, deliberately: a negative control caught this assertion
    // passing while a hex sat in the branch the default never renders.
    for (const variant of ["full", "small"] as const) {
      const { container, unmount } = render(<GrovetraceMark variant={variant} />);
      const svg = container.querySelector("svg")!;
      expect(svg.innerHTML).toContain("currentColor");
      expect(svg.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
      unmount();
    }
  });

  it("draws the full mark with five survey vertices", () => {
    const { container } = render(<GrovetraceMark variant="full" />);
    expect(container.querySelectorAll("circle")).toHaveLength(5);
  });

  it("draws the small variant with three, for sizes where five collapse", () => {
    // Not cosmetic: at the 19px the sidebar renders, five beads are mush.
    // If the variant prop ever stops being wired through, this catches it.
    const { container } = render(<GrovetraceMark variant="small" />);
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("keeps the land-plot polygon in both variants", () => {
    // The polygon is the whole concept: an EUDR plot boundary, not a tree.
    for (const variant of ["full", "small"] as const) {
      const { container, unmount } = render(<GrovetraceMark variant={variant} />);
      expect(container.querySelector("polygon")).toBeInTheDocument();
      unmount();
    }
  });
});

describe("product naming", () => {
  it("titles the tab with the name alone while no descriptor is set", () => {
    expect(PRODUCT_TITLE).toBe(
      PRODUCT_DESCRIPTOR ? `${PRODUCT_NAME} · ${PRODUCT_DESCRIPTOR}` : PRODUCT_NAME
    );
  });

  it("carries no em dash in any chrome string", () => {
    // Decision 3. The tab title used to read "Grovetrace — EUDR Compliance
    // Platform", which is both the em dash and the category filler.
    for (const s of [PRODUCT_NAME, PRODUCT_TITLE, PRODUCT_DESCRIPTION, PRODUCT_DESCRIPTOR ?? ""]) {
      expect(s).not.toContain("—");
    }
  });

  it("describes what the product does rather than which category it is in", () => {
    // The old description was "Deforestation-free supply chain management &
    // due diligence reporting" — four category nouns and no claim.
    expect(PRODUCT_DESCRIPTION).toMatch(/clear customs/i);
    expect(PRODUCT_DESCRIPTION.length).toBeGreaterThan(40);
  });
});
